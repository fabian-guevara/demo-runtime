import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(currentDir, "../..");
const rootDir = resolve(serverDir, "..");

const preservedEnv = {
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
  GROVE_API_KEY: process.env.GROVE_API_KEY,
  GROVE_MODEL: process.env.GROVE_MODEL,
  GROVE_BASE_URL: process.env.GROVE_BASE_URL,
  GROVE_API_URL: process.env.GROVE_API_URL,
  VOYAGE_API_KEY: process.env.VOYAGE_API_KEY
};

dotenv.config({ path: resolve(rootDir, ".env"), override: false });
dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

for (const [key, value] of Object.entries(preservedEnv)) {
  if (value !== undefined) {
    process.env[key] = value;
  }
}

function readBool(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readNumber(name, defaultValue) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

const env = {
  mongodbUri: process.env.MONGODB_URI ?? "",
  mongodbDb: process.env.MONGODB_DB_NAME || process.env.MONGODB_DB || "agentic_metadata_demo",
  groveModel: process.env.GROVE_MODEL ?? "gpt-5.5",
  groveApiUrl:
    process.env.GROVE_BASE_URL ||
    process.env.GROVE_API_URL ||
    "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses",
  voyageApiKey: process.env.VOYAGE_API_KEY ?? "",
  voyageEmbeddingModel: process.env.EMBEDDING_MODEL || process.env.VOYAGE_EMBEDDING_MODEL || "voyage-4",
  demoRuntimeUrl: process.env.DEMO_RUNTIME_URL ?? "http://localhost:4000/api",
  requireVectorSearch: readBool("REQUIRE_VECTOR_SEARCH", false),
  requireEmbeddings: readBool("REQUIRE_EMBEDDINGS", false),
  requireLlm: readBool("REQUIRE_LLM", false),
  enforcePolicy: readBool("ENFORCE_POLICY", false),
  queryLimitDefault: readNumber("QUERY_LIMIT_DEFAULT", 100),
  groveTimeoutMs: readNumber("GROVE_TIMEOUT_MS", 45000),
  rootDir,
  serverDir
};

export default env;
