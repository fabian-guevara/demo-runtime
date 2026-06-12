import "dotenv/config";
import { runEnvironmentValidation } from "@chat-mcp/mongodb";
import { validateBedrockAccess } from "@chat-mcp/agents";
import { validateMcpServer } from "@chat-mcp/mcp";

const validation = await runEnvironmentValidation({
  validateBedrockAccess,
  validateMcpServer
});

console.log(JSON.stringify(validation, null, 2));
