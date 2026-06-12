import "dotenv/config";
import { resetDemoData } from "@chat-mcp/mongodb";

const result = await resetDemoData();
console.log(JSON.stringify(result, null, 2));
