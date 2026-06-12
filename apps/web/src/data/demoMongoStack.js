const DEMO_MONGO_STACK = {
  "agentic-metadata-poc":
    "Atlas cluster · Vector Search · metadata graph · query audit trail",
  "ai-analytics-agent":
    "Atlas cluster · Vector Search · chat history · agent checkpoints",
  "chat-with-mongodb-mcp":
    "Atlas cluster · MCP Server · Vector Search · Atlas Charts",
  "customer-360":
    "Atlas cluster · Atlas Search · Vector Search care KB · MCP analytics"
};

export function getDemoMongoStack(demo) {
  return demo.mongoStack || DEMO_MONGO_STACK[demo.id] || "";
}
