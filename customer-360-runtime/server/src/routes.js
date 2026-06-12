import { Router } from "express";
import { readFile } from "node:fs/promises";
import { getDb } from "./db.js";
import { seedDatabase } from "./seed.js";
import { runChat } from "./services/chatService.js";
import { getDemoSettings, saveDemoSettings } from "./services/demoSettings.js";
import {
  autocompleteCustomers,
  getCustomerProfile,
  getCustomerStats,
  searchCustomers
} from "./services/customerInsights.js";
import { groveConfigured, readGroveModel } from "./services/groveClient.js";
import { readVoyageStatus } from "./services/embeddings.js";
import { reloadGroveCredentialsFromLocalEnv } from "./utils/reloadGroveCredentials.js";
import { listTrackedActions } from "../../.demo/runtime-tracker.js";

const router = Router();
const telemetryPath = new URL("../../.demo/telemetry.jsonl", import.meta.url);

router.get("/health", async (_req, res) => {
  try {
    const db = await getDb();
    const stats = await getCustomerStats(db);
    res.json({
      ok: true,
      llmModel: readGroveModel(),
      groveConfigured: groveConfigured(),
      voyage: readVoyageStatus(),
      stats
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
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
    const settings = await saveDemoSettings(db, req.body ?? {});
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/customers/stats", async (_req, res) => {
  try {
    const db = await getDb();
    res.json(await getCustomerStats(db));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/customers/autocomplete", async (req, res) => {
  try {
    const db = await getDb();
    const customers = await autocompleteCustomers(db, {
      q: req.query.q ?? "",
      segment: req.query.segment ?? "",
      limit: Number(req.query.limit ?? 8)
    });
    res.json({ customers });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/customers/search", async (req, res) => {
  try {
    const db = await getDb();
    const customers = await searchCustomers(db, {
      q: req.query.q ?? "",
      segment: req.query.segment ?? "",
      limit: Number(req.query.limit ?? 20)
    });
    res.json({ customers });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/customers/:customerId", async (req, res) => {
  try {
    const db = await getDb();
    const profile = await getCustomerProfile(db, req.params.customerId);
    if (!profile) {
      res.status(404).json({ error: "Customer not found." });
      return;
    }
    res.json(profile);
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
