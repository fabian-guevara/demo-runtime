import { Router } from "express";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import env from "./config/env.js";
import { getDb } from "./db.js";
import { retrieveRelevantMetadata } from "./retrieval.js";
import { entitiesToRetrievalContext, getGraphRagMode, similaritySearch } from "./graphRagStore.js";
import { buildQueryPlan } from "./queryPlanner.js";
import { attachCatalogToPlan, generateSqlDraft } from "./sqlGenerator.js";
import {
  generateAnswerWithGrove,
  generateMongoAlternativeWithGrove,
  getLlmMode
} from "./llm.js";
import { getEmbeddingMode } from "./embeddings.js";
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
    if (!table?.tableName || seen.has(table.tableName)) {
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

function buildAnswer({ question, plan, sql, governance }) {
  if (!plan.isValid) {
    return `Cannot answer from available metadata: ${plan.validationErrors.join(" ")}`;
  }

  if (sql.status !== "generated") {
    return `Metadata evidence was retrieved, but a safe SQL draft could not be generated: ${(sql.warnings ?? []).join(" ")}`;
  }

  return `Grounded metadata plan prepared for: ${plan.intent}`;
}

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    modes: {
      llm: getLlmMode(),
      graph: getGraphRagMode(),
      embedding: getEmbeddingMode(),
      retrieval: env.requireVectorSearch ? "vector-required" : "vector-or-lexical-degraded"
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
        source: /voyage|embedding/i.test(error.message) ? "voyage" : "mongodb",
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
    const graphContext = entitiesToRetrievalContext(graphRag.entities, tableCatalog, edgeCatalog);
    const graphTraversalMs = Math.round(performance.now() - graphStarted);

    const planStarted = performance.now();
    const plan = attachCatalogToPlan(
      await buildQueryPlan({
        question,
        retrievedTables: uniqueTables([...retrieval.retrievedTables, ...graphContext.tables]),
        retrievedEdges: graphContext.edges.length > 0 ? graphContext.edges : retrieval.retrievedEdges,
        graphEvidence: graphContext,
        allTables: tableCatalog,
        allEdges: edgeCatalog
      }),
      tableCatalog
    );
    const generationMs = Math.round(performance.now() - planStarted);

    if (env.enforcePolicy && plan.policyWarnings?.length > 0) {
      const error = new Error(`Policy enforcement blocked this query: ${plan.policyWarnings.join(" ")}`);
      error.code = "POLICY_BLOCKED";
      throw error;
    }

    const sql = generateSqlDraft(plan, { question });
    const governance = {
      policyWarnings: plan.policyWarnings ?? [],
      sensitiveFields: plan.sensitiveFields ?? []
    };

    const mongoAlternative = await generateMongoAlternativeWithGrove({
      question,
      plan,
      tableCatalog
    });

    let answer = buildAnswer({ question, plan, sql, governance });
    try {
      answer = await generateAnswerWithGrove({
        question,
        plan,
        sql,
        mongoAlternative,
        governance
      });
    } catch (error) {
      if (env.requireLlm) {
        throw error;
      }
    }

    const totalMs = Math.round(performance.now() - totalStarted);

    const response = {
      question,
      answer,
      retrieval: {
        mode: retrieval.retrievalMode,
        results: uniqueTables([...retrieval.retrievedTables, ...graphContext.tables]).slice(0, 8),
        warnings: retrieval.warnings
      },
      graph: {
        mode: graphRag.mode,
        paths: graphRag.paths,
        evidence: graphContext.examples
      },
      plan: {
        isValid: plan.isValid,
        intent: plan.intent,
        tables: plan.tables,
        columns: plan.columns,
        joins: plan.joins,
        filters: plan.filters,
        metrics: plan.metrics,
        assumptions: plan.assumptions,
        confidence: plan.confidence,
        validationErrors: plan.validationErrors ?? [],
        validationWarnings: plan.validationWarnings ?? []
      },
      sql,
      mongodbAlternative: mongoAlternative,
      governance,
      debug: {
        timings: {
          vectorSearchMs,
          graphTraversalMs,
          generationMs,
          totalMs
        },
        llmMode: getLlmMode(),
        embeddingMode: retrieval.embeddingMode,
        retrievalMode: retrieval.retrievalMode,
        graphMode: graphRag.mode
      },
      retrievedTables: uniqueTables([
        ...retrieval.retrievedTables,
        ...graphContext.tables,
        ...plan.tables
          .map((plannedTable) => tableCatalog.find((table) => table.tableName === plannedTable.tableName))
          .filter(Boolean)
      ]).slice(0, 8),
      retrievedEdges: uniqueEdges([
        ...(graphContext.edges.length > 0 ? graphContext.edges : retrieval.retrievedEdges),
        ...plan.joins
      ]).slice(0, 8),
      graphRagEntities: graphRag.entities
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
          intent: plan.intent,
          llmMode: getLlmMode(),
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
          /voyage|embedding/i.test(error.message)
            ? "voyage"
            : /grove|llm|json parse|validation failed/i.test(error.message)
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
