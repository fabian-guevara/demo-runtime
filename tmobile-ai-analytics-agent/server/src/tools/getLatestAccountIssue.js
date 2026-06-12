import { getLatestAccountIssue } from "../services/analyticsService.js";

export default async function getLatestAccountIssueTool(input) {
  return getLatestAccountIssue({
    ...input,
    toolName: "getLatestAccountIssue"
  });
}
