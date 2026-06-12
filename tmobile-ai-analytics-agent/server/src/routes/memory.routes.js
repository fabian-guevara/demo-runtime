import { Router } from "express";
import env from "../config/env.js";
import { clearMemories, listMemories, putMemory } from "../services/longTermMemoryService.js";

const router = Router();

function namespaceForUser(userId) {
  return ["user", userId ?? "demo-user"];
}

router.get("/", async (req, res) => {
  try {
    const result = await listMemories({
      namespace: namespaceForUser(req.query.userId)
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.post("/", async (req, res) => {
  if (!req.body?.memoryText?.trim()) {
    res.status(400).json({
      error: "memoryText is required."
    });
    return;
  }

  try {
    const result = await putMemory({
      namespace: namespaceForUser(req.body?.userId),
      key: req.body?.key ?? `memory-${Date.now()}`,
      value: req.body.memoryText.trim(),
      metadata: {
        region: req.body?.metadata?.region ?? "Texas",
        segment: req.body?.metadata?.segment ?? "enterprise",
        memoryType: req.body?.metadata?.memoryType ?? "preference",
        namespace: env.memoryNamespace
      }
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.delete("/", async (req, res) => {
  try {
    const result = await clearMemories({
      namespace: namespaceForUser(req.query.userId ?? req.body?.userId)
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

export default router;
