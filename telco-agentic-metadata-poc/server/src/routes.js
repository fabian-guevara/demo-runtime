import { Router } from "express";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import env from "./config/env.js";
import { getDb } from "./db.js";
import { retrieveRelevantMetadata } from "./retrieval.js";
import { entitiesToRetrievalContext, getGraphRagMode, similaritySearch } from "./graphRagStore.js";
import { buildQueryPlan } from "./queryPlanner.js";
import { attachCatalogToPlan, generateSqlDraft } from "./sqlGenerator.js";
import { generateAnswerWithGrove, generateMongoAlternativeWithGrove, getLlmMode } from "./llm.js";
import { getEmbeddingMode } from "./embeddings.js";
import { validateQueryPlan } from "./planValidator.js";
import { collectPolicyWarnings } from "./governance.js";
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

function buildAnswer({ plan, sql }) {
  if (!plan.isValid) {
    return `Cannot answer from available metadata: ${(plan.validationErrors ?? []).join(" ")}`;
  }

  if (sql.status !== "generated") {
    return `Metadata evidence was retrieved, but a safe SQL draft could not be generated: ${(sql.warnings ?? []).join(" ")}`;
  }

  return `Grounded metadata plan prepared for: ${plan.intent}`;
}

function finalizePlan(rawPlan, { question, tableCatalog, edgeCatalog }) {
  const validated = validateQueryPlan(rawPlan, { question, tableCatalog, edgeCatalog });
  return {
    ...rawPlan,
    ...validated
  };
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
    const llmWarnings = [];

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
    const rawPlan = await buildQueryPlan({
      question,
      retrievedTables: uniqueTables([...retrieval.retrievedTables, ...graphContext.tables]),
      retrievedEdges: graphContext.edges.length > 0 ? graphContext.edges : retrieval.retrievedEdges,
      graphEvidence: graphContext,
      allTables: tableCatalog,
      allEdges: edgeCatalog
    });
    const plan = finalizePlan(attachCatalogToPlan(rawPlan, tableCatalog), {
      question,
      tableCatalog,
      edgeCatalog
    });
    const generationMs = Math.round(performance.now() - planStarted);

    if (env.enforcePolicy && plan.policyWarnings?.length > 0) {
      const error = new Error(`Policy enforcement blocked this query: ${plan.policyWarnings.join(" ")}`);
      error.code = "POLICY_BLOCKED";
      throw error;
    }

    const sql = plan.isValid
      ? generateSqlDraft(plan, { question })
      : {
          status: "validation_failed",
          text: "",
          warnings: plan.validationErrors ?? ["Plan validation failed."]
        };

    const governance = {
      policyWarnings: plan.policyWarnings ?? [],
      sensitiveFields: plan.sensitiveFields ?? collectPolicyWarnings(plan, tableCatalog).sensitiveFields
    };

    const mongodbAlternative = await generateMongoAlternativeWithGrove({
      question,
      plan,
      tableCatalog
    });

    let answer = buildAnswer({ plan, sql });
    try {
      const groveAnswer = await generateAnswerWithGrove({
        question,
        plan,
        sql,
        mongoAlternative,
        governance
      });
      if (groveAnswer) {
        answer = groveAnswer;
      }
    } catch (error) {
      if (env.requireLlm) {
        throw error;
      }
      llmWarnings.push(error.message);
    }

    if (!env.requireLlm) {
      llmWarnings.push("REQUIRE_LLM=false: metadata-grounded planner and deterministic answer path are active.");
    }

    const totalMs = Math.round(performance.now() - totalStarted);
    const llmDegraded = llmWarnings.length > 0 || plan.planSource !== "grove";

    const response = {
      answer,
      retrieval: {
        mode: retrieval.retrievalMode,
        results: uniqueTables([...retrieval.retrievedTables, ...graphContext.tables]).slice(0, 8),
        warnings: retrieval.warnings
      },
      graph: {
        mode: graphRag.mode,
        paths: graphRag.paths,
        evidence: [...(graphContext.examples ?? []), ...(plan.graphEvidence ?? [])]
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
      mongodbAlternative,
      governance,
      debug: {
        timings: {
          vectorSearchMs,
          graphTraversalMs,
          generationMs,
          totalMs
        },
        llmMode: getLlmMode({ degraded: llmDegraded }),
        embeddingMode: retrieval.embeddingMode,
        retrievalMode: retrieval.retrievalMode,
        graphMode: graphRag.mode,
        llmWarnings,
        planSource: plan.planSource ?? "metadata"
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
          intent: plan.intent,
          llmMode: response.debug.llmMode,
          retrievalMode: retrieval.retrievalMode
        }
      },
      metadata: {
        totalMs
      },
      run: async () =>
        db.collection("query_runs").insertOne({
          question,
          ...response,
          createdAt: new Date().toISOString()
        })
    });

    res.json(response);
  } catch (error) {
    res.status(400).json(
      logStructuredError(error, {
        source:
          /voyage|embedding|embeddings_unavailable/i.test(error.message)
            ? "voyage"
            : /vector_search_unavailable/i.test(error.message)
              ? "retrieval"
              : /grove|llm|json parse|validation failed|llm_validation_failed/i.test(error.message)
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
