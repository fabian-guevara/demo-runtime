import env from "../config/env.js";
import { getDb } from "../config/db.js";
import logger from "../utils/logger.js";
import { sanitizeObject } from "../utils/redact.js";
import { summarizeMongoResponse } from "../utils/summarizeMongoResponse.js";

const recentTelemetry = [];

function summarizeExplain(explainResult) {
  if (!explainResult) {
    return null;
  }

  const executionStats = explainResult.executionStats ?? {};
  const winningPlan =
    explainResult.queryPlanner?.winningPlan ??
    explainResult.stages?.find((stage) => stage.$cursor)?.$cursor?.queryPlanner?.winningPlan ??
    null;

  const indexes = new Set();

  function collectIndexes(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.indexName) {
      indexes.add(node.indexName);
    }

    for (const value of Object.values(node)) {
      collectIndexes(value);
    }
  }

  collectIndexes(winningPlan);

  return {
    indexesUsed: [...indexes],
    totalDocsExamined: executionStats.totalDocsExamined ?? null,
    totalKeysExamined: executionStats.totalKeysExamined ?? null,
    executionTimeMillis:
      executionStats.executionTimeMillis ?? explainResult.executionTimeMillis ?? null
  };
}

function estimateReturnedCount(result) {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (typeof result?.length === "number") {
    return result.length;
  }

  if (typeof result?.count === "number") {
    return result.count;
  }

  if (typeof result?.matchedCount === "number") {
    return result.matchedCount;
  }

  if (typeof result?.modifiedCount === "number") {
    return result.modifiedCount;
  }

  return null;
}

async function insertTelemetry(doc) {
  try {
    const db = await getDb();
    await db.collection("demo_telemetry").insertOne(doc);
  } catch (error) {
    logger.warn("Telemetry persistence failed", {
      message: error.message
    });
  }
}

async function postToRuntime(doc) {
  if (!env.demoRuntimeUrl) {
    return;
  }

  try {
    await fetch(`${env.demoRuntimeUrl}/telemetry/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        demoId: "ai-analytics-agent",
        entry: doc
      })
    });
  } catch {
    // Runtime integration is best-effort.
  }
}

export async function trackedMongoAction({
  name,
  toolName,
  dbName,
  collectionName,
  operation,
  query,
  run,
  explain,
  llmModel,
  embeddingModel,
  memory,
  metadata
}) {
  const started = Date.now();
  let result;
  let error = null;
  let explainSummary = null;

  try {
    result = await run();
  } catch (caught) {
    error = {
      name: caught?.name ?? "Error",
      message: caught?.message ?? "Unknown error"
    };
    throw caught;
  } finally {
    if (typeof explain === "function") {
      try {
        explainSummary = summarizeExplain(await explain());
      } catch (explainError) {
        explainSummary = {
          error: explainError.message
        };
      }
    }

    const doc = sanitizeObject({
      timestamp: new Date().toISOString(),
      name,
      toolName,
      dbName,
      collectionName,
      operation,
      query,
      durationMs: Date.now() - started,
      nReturned: error ? null : estimateReturnedCount(result),
      response: error ? null : summarizeMongoResponse(result),
      explainSummary,
      llmModel: llmModel ?? env.groveModel ?? null,
      embeddingModel: embeddingModel ?? "voyage-client-side",
      memory: memory ?? null,
      metadata: metadata ?? null,
      error
    });

    recentTelemetry.unshift(doc);
    recentTelemetry.splice(40);
    await insertTelemetry(doc);
    await postToRuntime(doc);
  }

  return {
    result,
    telemetryId: recentTelemetry[0]?.timestamp
      ? `${recentTelemetry[0].timestamp}:${recentTelemetry[0].name}`
      : `${Date.now()}:${name}`
  };
}

export async function listRecentTelemetry(limit = 25) {
  try {
    const db = await getDb();
    return await db
      .collection("demo_telemetry")
      .find({}, { sort: { timestamp: -1 }, limit })
      .toArray();
  } catch {
    return recentTelemetry.slice(0, limit);
  }
}
