import { searchAccountContext } from "../services/vectorSearchService.js";

export default async function searchAccountContextTool(input) {
  return searchAccountContext(input);
}
