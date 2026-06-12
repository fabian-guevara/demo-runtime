import { searchMemories } from "../services/longTermMemoryService.js";

export default async function searchLongTermMemory(input) {
  return searchMemories({
    namespace: input.namespace,
    query: input.query,
    limit: input.limit
  });
}
