import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoDir = dirname(fileURLToPath(import.meta.url));
const telemetryPath = resolve(demoDir, "telemetry.jsonl");

function safeClone(value) {
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
  return {
    indexesUsed: executionStats.executionStages?.indexName
      ? [executionStats.executionStages.indexName]
      : [],
    totalDocsExamined: executionStats.totalDocsExamined ?? null,
    totalKeysExamined: executionStats.totalKeysExamined ?? null,
    executionTimeMillis:
      executionStats.executionTimeMillis ?? explainOutput.executionTimeMillis ?? null
  };
}

async function persistLocally(payload) {
  await mkdir(dirname(telemetryPath), { recursive: true });
  await appendFile(telemetryPath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function emitRuntime(payload) {
  const runtimeBaseUrl = process.env.DEMO_RUNTIME_URL;

  if (!runtimeBaseUrl) {
    await persistLocally(payload);
    return;
  }

  try {
    const response = await fetch(`${runtimeBaseUrl}/telemetry/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        demoId: process.env.DEMO_ID ?? "ai-analytics-agent",
        entry: payload
      })
    });

    if (!response.ok) {
      throw new Error(`Telemetry post failed with status ${response.status}`);
    }
  } catch {
    await persistLocally(payload);
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
    return result;
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

    await emitRuntime({
      timestamp: new Date().toISOString(),
      name,
      toolName,
      dbName,
      collectionName,
      operation,
      query: safeClone(query),
      durationMs: Date.now() - started,
      explainSummary,
      llmModel: llmModel ?? null,
      embeddingModel: embeddingModel ?? null,
      memory: memory ?? null,
      metadata: metadata ?? null,
      error
    });
  }
}
