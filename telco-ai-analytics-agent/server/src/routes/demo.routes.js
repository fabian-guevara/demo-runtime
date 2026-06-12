import { Router } from "express";
import env from "../config/env.js";
import { resetDemoData } from "../data/reset.js";
import { seedDemoData } from "../data/seed.js";
import { listRecentTelemetry } from "../services/telemetryService.js";
import { reloadGroveCredentialsFromLocalEnv } from "../utils/reloadGroveCredentials.js";

const router = Router();

router.get("/actions", async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const actions = await listRecentTelemetry(limit);
  res.json({ actions });
});

router.post("/reset", async (_req, res) => {
  try {
    await resetDemoData();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/seed", async (_req, res) => {
  try {
    await seedDemoData();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/reload-credentials", (_req, res) => {
  const result = reloadGroveCredentialsFromLocalEnv(env.rootDir);
  res.json({ ok: true, ...result });
});

export default router;
