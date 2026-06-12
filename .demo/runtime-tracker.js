import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const trackerDir = dirname(fileURLToPath(import.meta.url));
const localTelemetryFile = resolve(trackerDir, "telemetry.jsonl");

function safeClone(value) {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function summarizeExplain(explainOutput) {
  if (!explainOutput) {
    return null;
  }

  const executionStats = explainOutput.executionStats ?? {};
  const queryPlanner = explainOutput.queryPlanner ?? {};

  return {
    indexesUsed: queryPlanner.winningPlan?.inputStage?.indexName
      ? [queryPlanner.winningPlan.inputStage.indexName]
      : [],
    totalDocsExamined: executionStats.totalDocsExamined ?? null,
    totalKeysExamined: executionStats.totalKeysExamined ?? null,
    executionTimeMillis:
      executionStats.executionTimeMillis ?? explainOutput.executionTimeMillis ?? null
  };
}

function estimateReturnedCount(result) {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (typeof result?.length === "number") {
    return result.length;
  }

  if (typeof result?.matchedCount === "number") {
    return result.matchedCount;
  }

  if (typeof result?.modifiedCount === "number") {
    return result.modifiedCount;
  }

  if (typeof result?.insertedCount === "number") {
    return result.insertedCount;
  }

  return null;
}

async function writeLocalTelemetry(payload) {
  await mkdir(dirname(localTelemetryFile), { recursive: true });
  await appendFile(localTelemetryFile, `${JSON.stringify(payload)}\n`, "utf8");
}

async function sendToRuntime(payload) {
  const runtimeBaseUrl = process.env.DEMO_RUNTIME_URL;

  if (!runtimeBaseUrl) {
    await writeLocalTelemetry(payload);
    return;
  }

  try {
    const response = await fetch(`${runtimeBaseUrl}/telemetry/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        demoId: process.env.DEMO_ID ?? null,
        entry: payload
      })
    });

    if (!response.ok) {
      throw new Error(`Runtime telemetry ingestion failed with status ${response.status}`);
    }
  } catch {
    await writeLocalTelemetry(payload);
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
  atlasSearchStage,
  vectorSearchStage,
  llmModel,
  embeddingModel,
  tokenEstimate,
  conversationId,
  checkpointCollection,
  lastCheckpointTimestamp,
  followUpContext
}) {
  const started = Date.now();
  let result;
  let error = null;
  let explainSummary = null;

  try {
    result = await run();
    return result;
  } catch (err) {
    error = {
      name: err?.name ?? "Error",
      message: err?.message ?? "Unknown error"
    };
    throw err;
  } finally {
    if (typeof explain === "function") {
      try {
        explainSummary = summarizeExplain(await explain());
      } catch (explainError) {
        explainSummary = {
          error: explainError?.message ?? "Explain unavailable"
        };
      }
    }

    const telemetry = {
      timestamp: new Date().toISOString(),
      name,
      toolName,
      dbName,
      collectionName,
      operation,
      query: safeClone(query),
      durationMs: Date.now() - started,
      nReturned: estimateReturnedCount(result),
      explainSummary,
      atlasSearchStage: safeClone(atlasSearchStage),
      vectorSearchStage: safeClone(vectorSearchStage),
      llmModel: llmModel ?? null,
      embeddingModel: embeddingModel ?? null,
      tokenEstimate: tokenEstimate ?? null,
      conversationId: conversationId ?? null,
      checkpointCollection: checkpointCollection ?? null,
      lastCheckpointTimestamp: lastCheckpointTimestamp ?? null,
      followUpContext: followUpContext ?? null,
      error
    };

    await sendToRuntime(telemetry);
  }
}
