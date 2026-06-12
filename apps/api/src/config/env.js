import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(currentDir, "../..");
const rootDir = resolve(apiDir, "../..");
const demosDir = resolve(rootDir, "demos");
const runtimeDir = resolve(apiDir, ".runtime");
const rootEnvFile = resolve(rootDir, ".env");
const localEnvFile = resolve(apiDir, ".env.local");

dotenv.config({ path: rootEnvFile, override: false });
dotenv.config({ path: localEnvFile, override: true });

const env = {
  apiPort: Number(process.env.API_PORT ?? 4000),
  webPort: Number(process.env.WEB_PORT ?? 5173),
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173",
  demoRuntimeUrl: process.env.DEMO_RUNTIME_URL ?? "http://localhost:4000/api",
  groveModel: process.env.GROVE_MODEL ?? "gpt-5.5",
  groveApiUrl:
    process.env.GROVE_API_URL ??
    "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses",
  voyageEmbeddingModel: process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-4",
  apiDir,
  rootDir,
  demosDir,
  runtimeDir,
  rootEnvFile,
  localEnvFile
};

export default env;
