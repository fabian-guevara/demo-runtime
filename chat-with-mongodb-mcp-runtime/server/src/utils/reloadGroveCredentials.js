import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import env from "../config/env.js";

const DEMO_ENV_KEYS = [
  "GROVE_API_KEY",
  "API_KEY",
  "GROVE_MODEL",
  "GROVE_API_URL",
  "VOYAGE_API_KEY",
  "VOYAGE_EMBEDDING_MODEL",
  "VOYAGE_EMBEDDING_DIMENSIONS",
  "MONGODB_URI",
  "MONGODB_DB_NAME"
];

export function reloadGroveCredentialsFromLocalEnv() {
  const envPath = resolve(env.rootDir, ".env.local");

  if (!existsSync(envPath)) {
    return {
      reloaded: false,
      reason: "env-file-missing"
    };
  }

  const parsed = dotenv.parse(readFileSync(envPath, "utf8"));

  for (const key of DEMO_ENV_KEYS) {
    if (parsed[key] !== undefined && parsed[key] !== "") {
      process.env[key] = parsed[key];
    } else {
      delete process.env[key];
    }
  }

  return {
    reloaded: true,
    hasApiKey: Boolean(process.env.GROVE_API_KEY?.trim() || process.env.API_KEY?.trim()),
    hasVoyageKey: Boolean(process.env.VOYAGE_API_KEY?.trim())
  };
}
