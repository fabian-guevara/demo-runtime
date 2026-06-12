import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { redactValue } from "../utils/redact.js";

export const SHARED_DEMO_ENV_KEYS = [
  "MONGODB_URI",
  "MONGODB_DB",
  "MONGODB_DB_NAME",
  "GROVE_API_KEY",
  "GROVE_MODEL",
  "GROVE_API_URL",
  "VOYAGE_API_KEY",
  "VOYAGE_EMBEDDING_MODEL"
];

function quoteEnvValue(value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');

  return `"${escaped}"`;
}

async function readLocalEnv() {
  try {
    const contents = await readFile(env.localEnvFile, "utf8");
    return dotenv.parse(contents);
  } catch {
    return {};
  }
}

export async function getStoredCredentialValues(keys = []) {
  const localEnv = await readLocalEnv();
  return Object.fromEntries(
    keys.map((key) => [key, localEnv[key] ?? process.env[key] ?? ""])
  );
}

export async function getEffectiveEnvValues(keys = []) {
  return getStoredCredentialValues(keys);
}

export async function getSecretsForRedaction() {
  const localEnv = await readLocalEnv();
  return [
    ...Object.values(process.env),
    ...Object.values(localEnv)
  ].filter(Boolean);
}

export async function getMissingEnvVars(requiredEnv = []) {
  const values = await getStoredCredentialValues(requiredEnv);

  return requiredEnv.filter((key) => {
    return !values[key] || values[key]?.trim() === "";
  });
}

export async function syncAllDemoEnvFiles(values = {}) {
  const { loadDemoManifests } = await import("../config/demos.js");
  const demos = await loadDemoManifests();

  await Promise.all(
    demos.map(async (demo) => {
      try {
        const { access } = await import("node:fs/promises");
        await access(demo.repoPath);
        await syncDemoEnvFile(demo.repoPath, values);
      } catch {
        // Demo repo may not exist locally yet.
      }
    })
  );
}

export async function syncDemoEnvFile(repoPath, values = {}) {
  const demoEnvFile = resolve(repoPath, ".env.local");
  let localEnv = {};

  try {
    localEnv = dotenv.parse(await readFile(demoEnvFile, "utf8"));
  } catch {
    localEnv = {};
  }

  const nextEnv = {
    ...localEnv,
    ...Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined && value !== "")
    )
  };

  const lines = Object.entries(nextEnv)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`);

  await writeFile(demoEnvFile, `${lines.join("\n")}\n`, "utf8");

  logger.info("Synced demo .env.local", {
    repoPath,
    keys: Object.keys(values)
  });
}

export async function storeCredentials(values = {}) {
  const localEnv = await readLocalEnv();
  const nextEnv = {
    ...localEnv,
    ...values
  };

  const lines = Object.entries(nextEnv)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`);

  await writeFile(env.localEnvFile, `${lines.join("\n")}\n`, "utf8");

  for (const [key, value] of Object.entries(nextEnv)) {
    process.env[key] = value;
  }

  logger.info("Stored local runtime credentials", {
    keys: Object.keys(values),
    values: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, redactValue(value)])
    )
  });

  return {
    storedKeys: Object.keys(values)
  };
}

export async function clearCredentials(keys = []) {
  const localEnv = await readLocalEnv();

  for (const key of keys) {
    delete localEnv[key];
    delete process.env[key];
  }

  const lines = Object.entries(localEnv)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${quoteEnvValue(value)}`);

  await writeFile(env.localEnvFile, `${lines.join("\n")}\n`, "utf8");

  logger.info("Cleared local runtime credentials", {
    keys
  });

  return {
    clearedKeys: keys
  };
}
