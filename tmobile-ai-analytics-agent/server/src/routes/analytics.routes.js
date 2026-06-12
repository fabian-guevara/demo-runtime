import { Router } from "express";
import { compareChurnRiskMetrics, getChurnRiskMetrics } from "../services/analyticsService.js";

const router = Router();

router.get("/churn-risk", async (req, res) => {
  try {
    const result = await getChurnRiskMetrics({
      region: req.query.region ?? "Texas",
      segment: req.query.segment ?? "enterprise",
      month: req.query.month ?? "2026-05"
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.get("/churn-risk/compare", async (req, res) => {
  try {
    const result = await compareChurnRiskMetrics({
      region: req.query.region ?? "Texas",
      segment: req.query.segment ?? "enterprise",
      currentMonth: req.query.currentMonth ?? "2026-05",
      previousMonth: req.query.previousMonth ?? "2026-04"
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

export default router;
