import { Router } from "express";
import telemetryStore from "../services/telemetryStore.js";

const router = Router();

router.get("/", (req, res) => {
  const limit = Number(req.query.limit ?? 200);
  res.json({
    entries: telemetryStore.list(limit)
  });
});

router.delete("/", (_req, res) => {
  telemetryStore.clear();
  res.json({ ok: true });
});

router.post("/ingest", (req, res) => {
  const { demoId, entry } = req.body ?? {};

  if (!demoId || !entry || typeof entry !== "object") {
    res.status(400).json({
      error: "Body must include demoId and entry."
    });
    return;
  }

  telemetryStore.appendDemoAction(demoId, entry);
  res.status(202).json({ ok: true });
});

export default router;
