import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const GROVE_ENV_KEYS = ["GROVE_API_KEY", "API_KEY", "GROVE_MODEL", "GROVE_API_URL", "GROVE_BASE_URL"];
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function reloadGroveCredentialsFromLocalEnv() {
  const envPath = resolve(rootDir, ".env.local");

  if (!existsSync(envPath)) {
    return {
      reloaded: false,
      reason: "env-file-missing"
    };
  }

  const parsed = dotenv.parse(readFileSync(envPath, "utf8"));

  for (const key of GROVE_ENV_KEYS) {
    if (parsed[key] !== undefined && parsed[key] !== "") {
      process.env[key] = parsed[key];
    } else {
      delete process.env[key];
    }
  }

  return {
    reloaded: true,
    hasApiKey: Boolean(process.env.GROVE_API_KEY?.trim() || process.env.API_KEY?.trim())
  };
}
