import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(currentDir, "../..");
const rootDir = resolve(serverDir, "..");

dotenv.config({ path: resolve(rootDir, ".env"), override: false });
dotenv.config({ path: resolve(rootDir, ".env.local"), override: true });

const env = {
  mongodbUri: process.env.MONGODB_URI ?? "",
  mongodbDb: process.env.MONGODB_DB || "agentic_metadata_demo",
  groveModel: process.env.GROVE_MODEL ?? "gpt-5.5",
  groveApiUrl:
    process.env.GROVE_API_URL ??
    "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses",
  voyageApiKey: process.env.VOYAGE_API_KEY ?? "",
  voyageEmbeddingModel: process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4",
  demoRuntimeUrl: process.env.DEMO_RUNTIME_URL ?? "http://localhost:4000/api",
  rootDir,
  serverDir
};

export default env;
