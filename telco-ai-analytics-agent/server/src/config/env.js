import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(currentDir, "../..");
const rootDir = resolve(serverDir, "..");

dotenv.config({ path: resolve(rootDir, ".env"), override: false });
dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

function asBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const env = {
  port: Number(process.env.PORT ?? 4001),
  clientPort: Number(process.env.CLIENT_PORT ?? 5174),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5174",
  mongodbUri: process.env.MONGODB_URI ?? "",
  mongodbDbName: process.env.MONGODB_DB_NAME ?? "telco_ai_analytics_demo",
  groveModel: process.env.GROVE_MODEL ?? "gpt-5.5",
  groveApiUrl:
    process.env.GROVE_API_URL ??
    "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses",
  enableShortTermMemory: asBoolean(process.env.ENABLE_SHORT_TERM_MEMORY, true),
  enableLongTermMemory: asBoolean(process.env.ENABLE_LONG_TERM_MEMORY, true),
  memoryNamespace: process.env.MEMORY_NAMESPACE ?? "telco-demo",
  demoRuntimeUrl: process.env.DEMO_RUNTIME_URL ?? "http://localhost:5050",
  voyageApiKey: process.env.VOYAGE_API_KEY ?? "",
  voyageEmbeddingModel: process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-3.5-lite",
  voyageEmbeddingDimensions: Number(process.env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024),
  enableVectorFallback: asBoolean(process.env.ENABLE_VECTOR_FALLBACK, true),
  rootDir,
  serverDir
};

export default env;
