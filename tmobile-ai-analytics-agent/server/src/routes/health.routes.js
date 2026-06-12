import { Router } from "express";
import env from "../config/env.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    mode: "real-services-only",
    services: {
      mongodb: Boolean(env.mongodbUri),
      grove: Boolean(process.env.GROVE_API_KEY?.trim() || process.env.API_KEY?.trim()),
      voyageEmbeddings: Boolean(env.voyageApiKey),
      atlasAutoEmbedding: false,
      vectorFallbacksEnabled: env.enableVectorFallback,
      llmFallbacksEnabled: false
    }
  });
});

export default router;
