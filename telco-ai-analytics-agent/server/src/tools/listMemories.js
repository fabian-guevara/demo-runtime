import { listMemories } from "../services/longTermMemoryService.js";

export default async function listMemoriesTool(input) {
  return listMemories({
    namespace: input.namespace
  });
}
