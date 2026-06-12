import { Router } from "express";
import { startCluster } from "../services/clusterManager.js";

const router = Router();

router.post("/start", async (req, res) => {
  try {
    const result = await startCluster(req.body?.clusterName);
    res.json({
      ok: true,
      result
    });
  } catch (error) {
    res.status(400).json({
      error:
        error.code === "ENOENT"
          ? "The local 'start-cluster' command is not available on this machine."
          : error.message
    });
  }
});

export default router;
