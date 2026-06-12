import crypto from "node:crypto";
import { HIGH_SEVERITY_MESSAGES, NORMAL_MESSAGES } from "../data/catalog.js";
import { getDb } from "../db.js";
import { refreshTowerHealth } from "./towerHealth.js";

const state = {
  running: false,
  timer: null,
  injectErrors: true,
  documentsPerBatch: 30,
  errorsPerBatch: 12,
  intervalMs: 5000
};

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildDocuments(batchSize, injectErrors) {
  const documents = [];
  const errorTowers = new Set(["tower_2", "tower_7"]);

  for (let index = 0; index < batchSize; index += 1) {
    const towerNumber = (index % 10) + 1;
    const towerId = `tower_${towerNumber}`;
    const shouldError =
      injectErrors &&
      (errorTowers.has(towerId) || index < state.errorsPerBatch / 2);

    documents.push({
      source_tower_id: towerId,
      event_id: crypto.randomUUID(),
      event_description: shouldError ? randomItem(HIGH_SEVERITY_MESSAGES) : randomItem(NORMAL_MESSAGES),
      category: shouldError ? "SymmetricDS" : "STAT",
      severity: shouldError ? 4 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 3),
      event_timestamp: new Date()
    });
  }

  return documents;
}

async function emitBatch() {
  const db = await getDb();
  const documents = buildDocuments(state.documentsPerBatch, state.injectErrors);

  await db.collection("realtime_network_logs").insertMany(documents);
  await refreshTowerHealth(db);

  return documents.length;
}

export function getSimulatorStatus() {
  return {
    running: state.running,
    injectErrors: state.injectErrors,
    documentsPerBatch: state.documentsPerBatch,
    errorsPerBatch: state.errorsPerBatch,
    intervalMs: state.intervalMs
  };
}

export async function startSimulator(options = {}) {
  if (state.running) {
    return getSimulatorStatus();
  }

  state.injectErrors = options.injectErrors ?? true;
  state.documentsPerBatch = options.documentsPerBatch ?? state.documentsPerBatch;
  state.errorsPerBatch = options.errorsPerBatch ?? state.errorsPerBatch;
  state.intervalMs = options.intervalMs ?? state.intervalMs;
  state.running = true;

  await emitBatch();
  state.timer = setInterval(() => {
    emitBatch().catch((error) => {
      console.error("[simulator] batch failed", error.message);
    });
  }, state.intervalMs);

  return getSimulatorStatus();
}

export async function stopSimulator() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  state.running = false;
  return getSimulatorStatus();
}

export async function injectErrorBurst() {
  const previous = state.injectErrors;
  state.injectErrors = true;
  const inserted = await emitBatch();
  state.injectErrors = previous;
  return { inserted };
}
