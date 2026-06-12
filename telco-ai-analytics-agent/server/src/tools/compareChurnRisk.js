import { compareChurnRiskMetrics } from "../services/analyticsService.js";

export default async function compareChurnRisk(input) {
  return compareChurnRiskMetrics({
    ...input,
    toolName: "compareChurnRisk"
  });
}
