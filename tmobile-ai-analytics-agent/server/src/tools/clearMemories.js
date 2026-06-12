import { clearMemories } from "../services/longTermMemoryService.js";

export default async function clearMemoriesTool(input) {
  return clearMemories({
    namespace: input.namespace
  });
}
