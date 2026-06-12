import { Router } from "express";
import { readFile } from "node:fs/promises";
import { getDb } from "./db.js";
import { seedDatabase } from "./seed.js";
import { runChat } from "./services/chatService.js";
import { getDemoSettings, saveDemoSettings } from "./services/demoSettings.js";
import {
  getSimulatorStatus,
  injectErrorBurst,
  startSimulator,
  stopSimulator
} from "./services/simulator.js";
import { listTowerMapData, setAllTowersHealthy } from "./services/towerHealth.js";
import { groveConfigured, readGroveModel } from "./services/groveClient.js";
import { readVoyageStatus } from "./services/embeddings.js";
import { reloadGroveCredentialsFromLocalEnv } from "./utils/reloadGroveCredentials.js";
import { normalizeAtlasChartsEmbedUrl } from "./utils/atlasChartsEmbed.js";
import { listTrackedActions } from "../../.demo/runtime-tracker.js";

const router = Router();
const telemetryPath = new URL("../../.demo/telemetry.jsonl", import.meta.url);

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    llmModel: readGroveModel(),
    groveConfigured: groveConfigured(),
    voyage: readVoyageStatus(),
    simulator: getSimulatorStatus()
  });
});

router.get("/config", async (_req, res) => {
  try {
    const db = await getDb();
    res.json(await getDemoSettings(db));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/config", async (req, res) => {
  try {
    const db = await getDb();
    const mapUrlRaw = req.body?.atlasChartsTowerMapEmbedUrl ?? "";
    const dashboardUrlRaw = req.body?.atlasChartsTowerDashboardEmbedUrl ?? "";

    const settings = await saveDemoSettings(db, {
      atlasChartsTowerMapEmbedUrl: mapUrlRaw ? normalizeAtlasChartsEmbedUrl(mapUrlRaw) : "",
      atlasChartsTowerDashboardEmbedUrl: dashboardUrlRaw ? normalizeAtlasChartsEmbedUrl(dashboardUrlRaw) : ""
    });
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/towers/map", async (_req, res) => {
  try {
    const db = await getDb();
    res.json({ towers: await listTowerMapData(db) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/towers/all-healthy", async (_req, res) => {
  try {
    const db = await getDb();
    const result = await setAllTowersHealthy(db);
    res.json({ ok: true, result, towers: await listTowerMapData(db) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/chat", async (req, res) => {
  const message = req.body?.message?.trim();
  const sessionId = req.body?.sessionId?.trim();

  if (!message) {
    res.status(400).json({ error: "message is required." });
    return;
  }

  try {
    const db = await getDb();
    const result = await runChat({ db, message, sessionId });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message,
      code: error.code ?? "CHAT_FAILED"
    });
  }
});

router.post("/seed", async (_req, res) => {
  try {
    const result = await seedDatabase({ reset: true });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/simulator/start", async (req, res) => {
  try {
    const status = await startSimulator(req.body ?? {});
    res.json({ ok: true, status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/simulator/stop", async (_req, res) => {
  try {
    const status = await stopSimulator();
    res.json({ ok: true, status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/simulator/inject-errors", async (_req, res) => {
  try {
    const result = await injectErrorBurst();
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/simulator/status", (_req, res) => {
  res.json(getSimulatorStatus());
});

router.get("/demo/actions", async (_req, res) => {
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
    res.json({ actions: await listTrackedActions() });
  }
});

router.post("/demo/reload-credentials", (_req, res) => {
  res.json({ ok: true, ...reloadGroveCredentialsFromLocalEnv() });
});

export default router;
