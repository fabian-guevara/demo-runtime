import getChurnRisk from "../tools/getChurnRisk.js";
import compareChurnRisk from "../tools/compareChurnRisk.js";
import searchAccountContext from "../tools/searchAccountContext.js";
import getCustomerSegments from "../tools/getCustomerSegments.js";
import getLatestAccountIssue from "../tools/getLatestAccountIssue.js";
import rememberPreference from "../tools/rememberPreference.js";
import searchLongTermMemory from "../tools/searchLongTermMemory.js";
import listMemories from "../tools/listMemories.js";
import clearMemories from "../tools/clearMemories.js";

const registry = {
  getChurnRisk,
  compareChurnRisk,
  searchAccountContext,
  getCustomerSegments,
  getLatestAccountIssue,
  rememberPreference,
  searchLongTermMemory,
  listMemories,
  clearMemories
};

export async function callTool(name, input) {
  if (!registry[name]) {
    throw new Error(`Unknown tool '${name}'.`);
  }

  const output = await registry[name](input);
  return {
    name,
    input,
    output
  };
}

export function listAvailableTools() {
  return Object.keys(registry);
}
