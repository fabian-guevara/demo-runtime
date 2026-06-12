import { Router } from "express";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { getDb } from "./db.js";
import { retrieveRelevantMetadata } from "./retrieval.js";
import {
  entitiesToRetrievalContext,
  getGraphRagMode,
  similaritySearch
} from "./graphRagStore.js";
import { buildQueryPlan } from "./queryPlanner.js";
import { buildDeterministicArtifacts } from "./sqlGenerator.js";
import { enhanceArtifactsWithLlm, getLlmMode } from "./llm.js";
import { seedDatabase } from "./seed.js";
import { trackedRuntimeAction } from "../../.demo/runtime-tracker.js";
import { logStructuredError } from "./errors.js";
import { reloadGroveCredentialsFromLocalEnv } from "./utils/reloadGroveCredentials.js";

const router = Router();
const telemetryPath = new URL("../../.demo/telemetry.jsonl", import.meta.url);

async function loadCatalog(db) {
  const [tableCatalog, edgeCatalog] = await Promise.all([
    db.collection("table_nodes").find({}, { sort: { schemaName: 1, tableName: 1 } }).toArray(),
    db.collection("table_edges").find({}, { sort: { sourceTable: 1, targetTable: 1 } }).toArray()
  ]);

  return { tableCatalog, edgeCatalog };
}

function uniqueTables(tables) {
  const seen = new Set();
  return tables.filter((table) => {
    if (seen.has(table.tableName)) {
      return false;
    }

    seen.add(table.tableName);
    return true;
  });
}

function uniqueEdges(edges) {
  const seen = new Set();
  return edges.filter((edge) => {
    const key = `${edge.sourceTable}:${edge.sourceColumn}:${edge.targetTable}:${edge.targetColumn}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    modes: {
      llm: getLlmMode(),
      graphRag: getGraphRagMode(),
      retrieval: process.env.VOYAGE_API_KEY ? "vector-or-lexical-fallback" : "lexical-fallback"
    }
  });
});

router.get("/api/schema", async (_req, res) => {
  try {
    const db = await getDb();
    const { tableCatalog, edgeCatalog } = await loadCatalog(db);
    res.json({
      tables: tableCatalog,
      edges: edgeCatalog
    });
  } catch (error) {
    res.status(400).json(
      logStructuredError(error, {
        source: "mongodb",
        operation: "load-schema-overview",
        route: "/api/schema"
      })
    );
  }
});

router.get("/api/query-runs", async (_req, res) => {
  try {
    const db = await getDb();
    const runs = await db.collection("query_runs").find({}, { sort: { createdAt: -1 }, limit: 10 }).toArray();
    res.json({ runs });
  } catch (error) {
    res.status(400).json(
      logStructuredError(error, {
        source: "mongodb",
        operation: "load-query-runs",
        route: "/api/query-runs"
      })
    );
  }
});

router.post("/api/seed", async (_req, res) => {
  try {
    const result = await seedDatabase();
    res.json({
      ok: true,
      result
    });
  } catch (error) {
    res.status(400).json(
      logStructuredError(error, {
        source: /voyage/i.test(error.message) ? "voyage" : "mongodb",
        operation: "seed-catalog",
        route: "/api/seed"
      })
    );
  }
});

router.post("/api/query", async (req, res) => {
  const question = req.body?.question?.trim();

  if (!question) {
    res.status(400).json({
      error: "question is required."
    });
    return;
  }

  try {
    const db = await getDb();
    const { tableCatalog, edgeCatalog } = await loadCatalog(db);
    const totalStarted = performance.now();

    const retrievalStarted = performance.now();
    const retrieval = await retrieveRelevantMetadata({
      db,
      question,
      tableCatalog,
      edgeCatalog
    });
    const vectorSearchMs = Math.round(performance.now() - retrievalStarted);

    const graphStarted = performance.now();
    const graphRag = await similaritySearch({
      db,
      question,
      tables: tableCatalog,
      seedTables: retrieval.retrievedTables
    });
    const graphContext = entitiesToRetrievalContext(
      graphRag.entities,
      tableCatalog,
      edgeCatalog
    );
    const queryPlan = buildQueryPlan({
      question,
      retrievedTables: uniqueTables([...retrieval.retrievedTables, ...graphContext.tables]),
      retrievedEdges:
        graphContext.edges.length > 0
          ? graphContext.edges
          : retrieval.retrievedEdges,
      allTables: tableCatalog,
      allEdges: edgeCatalog
    });
    const graphTraversalMs = Math.round(performance.now() - graphStarted);

    const retrievedTables = uniqueTables([
      ...retrieval.retrievedTables,
      ...graphContext.tables,
      ...queryPlan.tables
        .map((plannedTable) => tableCatalog.find((table) => table.tableName === plannedTable.tableName))
        .filter(Boolean)
    ]).slice(0, 8);
    const retrievedEdges = uniqueEdges([
      ...(graphContext.edges.length > 0 ? graphContext.edges : retrieval.retrievedEdges),
      ...queryPlan.joins
    ]).slice(0, 8);

    const generationStarted = performance.now();
    const deterministicArtifacts = buildDeterministicArtifacts(queryPlan);
    const generated = await enhanceArtifactsWithLlm({
      question,
      retrievedTables,
      retrievedEdges,
      queryPlan,
      deterministicArtifacts
    });
    const generationMs = Math.round(performance.now() - generationStarted);
    const totalMs = Math.round(performance.now() - totalStarted);

    const response = {
      question,
      retrievedTables,
      retrievedEdges,
      graphRagEntities: graphRag.entities,
      queryPlan,
      generatedSql: generated.generatedSql,
      mongoAlternative: generated.mongoAlternative,
      explanation: generated.explanation,
      debug: {
        vectorSearchMs,
        graphTraversalMs,
        generationMs,
        totalMs,
        retrievalMode: retrieval.retrievalMode,
        llmMode: generated.llmMode,
        graphRagMode: graphRag.extractionMode,
        graphStartingEntities: graphRag.startingEntities,
        graphEntityCount: graphRag.entities.length
      }
    };

    await trackedRuntimeAction({
      name: "Persist query run",
      toolName: "queryRunLogger",
      dbName: db.databaseName,
      collectionName: "query_runs",
      operation: "insertOne",
      query: {
        document: {
          question,
          intent: queryPlan.intentKey,
          llmMode: generated.llmMode,
          retrievalMode: retrieval.retrievalMode
        }
      },
      metadata: {
        totalMs
      },
      run: async () =>
        db.collection("query_runs").insertOne({
          ...response,
          createdAt: new Date().toISOString()
        })
    });

    res.json(response);
  } catch (error) {
    res.status(400).json(
      logStructuredError(error, {
        source:
          /voyage/i.test(error.message)
            ? "voyage"
            : /openai|anthropic|bedrock|model|llm|json parse|unterminated string in json|unexpected token/i.test(
                  error.message
                )
              ? "llm"
              : "mongodb",
        operation: "run-agent-query",
        route: "/api/query"
      })
    );
  }
});

router.get("/api/demo/actions", async (_req, res) => {
  try {
    const raw = await readFile(telemetryPath, "utf8");
    const actions = raw
      .trim()
      .split(/\r?\n/g)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-30)
      .reverse();

    res.json({ actions });
  } catch {
    res.json({ actions: [] });
  }
});

router.post("/api/demo/reload-credentials", (_req, res) => {
  const result = reloadGroveCredentialsFromLocalEnv();
  res.json({ ok: true, ...result });
});

export default router;
