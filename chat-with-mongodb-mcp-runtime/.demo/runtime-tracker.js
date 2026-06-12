import crypto from "node:crypto";
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

export async function trackedRuntimeAction({
  name,
  toolName,
  dbName,
  collectionName,
  operation,
  query,
  metadata = {},
  run
}) {
  const started = performance.now();
  let response;
  let error;

  try {
    response = await run();
  } catch (caught) {
    error = caught;
  }

  const durationMs = Math.round(performance.now() - started);
  const payload = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    demoId: process.env.DEMO_ID ?? "chat-with-mongodb-mcp",
    name,
    toolName: toolName ?? "unknown",
    dbName: dbName ?? "unknown",
    collectionName: collectionName ?? "unknown",
    operation: operation ?? "unknown",
    query: safeClone(query ?? {}),
    durationMs,
    nReturned: Array.isArray(response) ? response.length : null,
    response: error ? null : summarizeMongoResponse(response),
    error: error
      ? {
          message: error.message
        }
      : null
  };

  await persistLocally(payload);

  if (error) {
    throw error;
  }

  return response;
}
