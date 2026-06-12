import { Router } from "express";
import {
  storeCredentials,
  syncAllDemoEnvFiles
} from "../services/credentialManager.js";
import { reloadRunningLlmDemos } from "../services/demoRunner.js";
import logger from "../utils/logger.js";

const router = Router();

router.post("/", async (req, res) => {
  const values = req.body?.values;

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    res.status(400).json({
      error: "Request body must include a 'values' object."
    });
    return;
  }

  try {
    logger.info("Saving runtime credentials", {
      keys: Object.keys(values)
    });

    const result = await storeCredentials(values);
    await syncAllDemoEnvFiles(values);
    const reloadedDemos = await reloadRunningLlmDemos();

    res.json({
      ok: true,
      ...result,
      reloadedDemos
    });
  } catch (error) {
    logger.error("Saving runtime credentials failed", {
      keys: Object.keys(values ?? {}),
      message: error.message
    });

    res.status(400).json({
      error: error.message,
      code: error.code ?? "CREDENTIALS_STORE_FAILED",
      credentialKeys: error.credentialKeys ?? []
    });
  }
});

export default router;
