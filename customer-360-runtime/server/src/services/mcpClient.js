import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import env from "../config/env.js";

export async function withMcpSession(run) {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required for MCP tools.");
  }

  const transport = new StdioClientTransport({
    command: env.mcpServerCommand,
    args: env.mcpServerArgs,
    env: {
      ...process.env,
      MDB_MCP_CONNECTION_STRING: env.mongodbUri,
      MDB_MCP_READ_ONLY: process.env.MDB_MCP_READ_ONLY ?? "true"
    },
    stderr: "pipe"
  });

  const client = new Client({
    name: "customer-360",
    version: "0.1.0"
  });

  try {
    await client.connect(transport);
  } catch (error) {
    throw new Error(
      `MongoDB MCP server failed to start. Run npm install in customer-360-runtime. ${error.message}`
    );
  }

  try {
    const listed = await client.listTools();
    return await run({
      client,
      tools: listed.tools ?? []
    });
  } finally {
    await client.close().catch(() => {});
  }
}

export async function callMcpTool(client, name, args = {}) {
  const result = await client.callTool({
    name,
    arguments: args
  });

  const textParts = (result.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text);

  return textParts.join("\n") || JSON.stringify(result);
}
