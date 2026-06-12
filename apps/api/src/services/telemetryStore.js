import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import env from "../config/env.js";
import { sanitizeObject } from "../utils/redact.js";

class TelemetryStore {
  constructor() {
    this.entries = [];
    this.maxEntries = 600;
    this.demoStates = new Map();
    this.clusterStates = new Map();
    this.demoActions = new Map();
  }

  append(entry) {
    const normalized = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: entry.timestamp ?? new Date().toISOString(),
      level: entry.level ?? "info",
      type: entry.type ?? "runtime-log",
      message: entry.message ?? "",
      demoId: entry.demoId ?? null,
      data: sanitizeObject(entry.data ?? null)
    };

    this.entries.unshift(normalized);
    this.entries = this.entries.slice(0, this.maxEntries);
    return normalized;
  }

  appendDemoAction(demoId, action) {
    const normalizedAction = sanitizeObject(action);
    const existing = this.demoActions.get(demoId) ?? [];
    existing.unshift(normalizedAction);
    this.demoActions.set(demoId, existing.slice(0, 50));

    this.append({
      demoId,
      type: "demo-action",
      level: normalizedAction.error ? "error" : "info",
      message: normalizedAction.name ?? "Tracked MongoDB action",
      data: normalizedAction
    });
  }

  list(limit = 200) {
    return this.entries.slice(0, limit);
  }

  clear() {
    this.entries = [];
    this.demoActions.clear();
  }

  getDemoActions(demoId, limit = 20) {
    return (this.demoActions.get(demoId) ?? []).slice(0, limit);
  }

  setDemoState(demoId, patch) {
    const current = this.demoStates.get(demoId) ?? {};
    const next = {
      ...current,
      ...patch
    };

    this.demoStates.set(demoId, next);
    return next;
  }

  getDemoState(demoId) {
    return this.demoStates.get(demoId) ?? {};
  }

  setClusterState(clusterName, patch) {
    const current = this.clusterStates.get(clusterName) ?? {};
    const next = {
      ...current,
      ...patch
    };

    this.clusterStates.set(clusterName, next);
    return next;
  }

  getClusterState(clusterName) {
    return this.clusterStates.get(clusterName) ?? {};
  }

  async readLocalDemoTelemetry(repoPath, limit = 20) {
    try {
      const telemetryFile = resolve(repoPath, ".demo/telemetry.jsonl");
      const raw = await readFile(telemetryFile, "utf8");
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
}

const telemetryStore = new TelemetryStore();

export default telemetryStore;
