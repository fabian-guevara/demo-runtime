import "dotenv/config";
import { ingestLocalDocuments } from "@chat-mcp/mongodb";

const result = await ingestLocalDocuments();
console.log(JSON.stringify(result, null, 2));
