import { putMemory } from "../services/longTermMemoryService.js";

export default async function rememberPreference(input) {
  return putMemory({
    namespace: input.namespace,
    key: input.key,
    value: input.memoryText,
    metadata: input.metadata
  });
}
