import "dotenv/config";
import { seedDemoData } from "@chat-mcp/mongodb";

const result = await seedDemoData();
console.log(JSON.stringify(result, null, 2));
