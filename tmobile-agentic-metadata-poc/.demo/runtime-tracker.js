import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeMongoResponse } from "../server/src/utils/summarizeMongoResponse.js";

const demoDir = dirname(fileURLToPath(import.meta.url));
const telemetryPath = resolve(demoDir, "telemetry.jsonl");

function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

async function persistLocally(payload) {
  await mkdir(dirname(telemetryPath), { recursive: true });
  await appendFile(telemetryPath, `${JSON.stringify(payload)}\n`, "utf8");
}

export async function listTrackedActions(limit = 30) {
  try {
    const raw = await readFile(telemetryPath, "utf8");
    return raw
      .trim()
      .split(/\r?\n/g)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
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

  if (typeof result?.insertedId !== "undefined") {
    return 1;
  }

  return null;
}

export async function trackedRuntimeAction({
  name,
  toolName,
  dbName,
  collectionName,
  operation,
  query,
  run,
  metadata
}) {
  const started = Date.now();
  let result;
  let error = null;

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
    const payload = {
      timestamp: new Date().toISOString(),
      name,
      toolName,
      dbName: dbName ?? null,
      collectionName: collectionName ?? null,
      operation,
      query: safeClone(query),
      durationMs: Date.now() - started,
      nReturned: error ? null : estimateReturnedCount(result),
      response: error ? null : summarizeMongoResponse(safeClone(result)),
      metadata: metadata ?? null,
      error
    };
    await persistLocally(payload);

    const runtimeBaseUrl = process.env.DEMO_RUNTIME_URL;

    if (!runtimeBaseUrl) {
      return;
    }

    try {
      const response = await fetch(`${runtimeBaseUrl}/telemetry/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          demoId: process.env.DEMO_ID ?? "agentic-metadata-poc",
          entry: payload
        })
      });

      if (!response.ok) {
        throw new Error(`Telemetry post failed with status ${response.status}`);
      }
    } catch {}
  }
}
