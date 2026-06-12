import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(currentDir, "../..");
const rootDir = resolve(serverDir, "..");

dotenv.config({ path: resolve(rootDir, ".env"), override: false });
dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

const env = {
  port: Number(process.env.PORT ?? 4004),
  clientPort: Number(process.env.CLIENT_PORT ?? 5179),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5179",
  mongodbUri: process.env.MONGODB_URI ?? "",
  mongodbDbName: process.env.MONGODB_DB_NAME ?? "customer_360",
  customerSeedCount: Number(process.env.CUSTOMER_SEED_COUNT ?? 1_000_000),
  interactionSeedCount: Number(process.env.INTERACTION_SEED_COUNT ?? 250_000),
  groveModel: process.env.GROVE_MODEL ?? "gpt-5.5",
  groveApiUrl:
    process.env.GROVE_API_URL ??
    "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses",
  voyageApiKey: process.env.VOYAGE_API_KEY ?? "",
  voyageEmbeddingModel: process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4",
  voyageEmbeddingDimensions: Number(process.env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024),
  kbVectorIndex: process.env.KB_VECTOR_INDEX ?? "care_kb_vector_index",
  customersSearchIndex: process.env.CUSTOMERS_SEARCH_INDEX ?? "customers_search_index",
  mcpServerCommand: process.env.MCP_SERVER_COMMAND ?? process.execPath,
  mcpServerArgs: process.env.MCP_SERVER_ARGS
    ? process.env.MCP_SERVER_ARGS.split(/\s+/).filter(Boolean)
    : [resolve(rootDir, "node_modules/mongodb-mcp-server/dist/esm/index.js")],
  demoRuntimeUrl: process.env.DEMO_RUNTIME_URL ?? "http://127.0.0.1:4000/api",
  chatMaxToolIterations: Number(process.env.CHAT_MAX_TOOL_ITERATIONS ?? 15),
  chatForceAnswerWhenRemaining: Number(process.env.CHAT_FORCE_ANSWER_WHEN_REMAINING ?? 2),
  chatDuplicateStopThreshold: Number(process.env.CHAT_DUPLICATE_STOP_THRESHOLD ?? 3),
  chatMaxToolResultChars: Number(process.env.CHAT_MAX_TOOL_RESULT_CHARS ?? 6000),
  rootDir,
  serverDir
};

export default env;
