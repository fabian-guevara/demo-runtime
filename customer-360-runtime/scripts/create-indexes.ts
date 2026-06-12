import "dotenv/config";
import { createDemoIndexes } from "@chat-mcp/mongodb";

const result = await createDemoIndexes();
console.log(JSON.stringify(result, null, 2));
