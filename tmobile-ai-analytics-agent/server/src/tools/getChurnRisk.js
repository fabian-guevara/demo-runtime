import { getChurnRiskMetrics } from "../services/analyticsService.js";

export default async function getChurnRisk(input) {
  return getChurnRiskMetrics({
    ...input,
    toolName: "getChurnRisk"
  });
}
