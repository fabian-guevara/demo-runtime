import { access } from "node:fs/promises";
import env from "../config/env.js";
import telemetryStore from "./telemetryStore.js";
import {
  getSecretsForRedaction,
  getStoredCredentialValues,
  SHARED_DEMO_ENV_KEYS,
  syncDemoEnvFile
} from "./credentialManager.js";
import { spawnCommand, waitForExit, splitOutputLines, isPortConflict } from "../utils/shell.js";
import { redactSecretsInText } from "../utils/redact.js";
import logger from "../utils/logger.js";

const runningProcesses = new Map();

async function ensureRepoExists(repoPath) {
  try {
    await access(repoPath);
  } catch {
    const error = new Error(`Demo repository not found at ${repoPath}`);
    error.code = "DEMO_REPO_MISSING";
    throw error;
  }
}

function appendStreamOutput({ demoId, level, chunk, secrets }) {
  for (const line of splitOutputLines(chunk)) {
    telemetryStore.append({
      demoId,
      level,
      type: "command-output",
      message: redactSecretsInText(line, secrets)
    });
  }
}

async function getDemoCommandEnv(demo) {
  const keys = [...new Set([...(demo.requiredEnv ?? []), ...SHARED_DEMO_ENV_KEYS])];
  const storedValues = await getStoredCredentialValues(keys);
  const envOverrides = Object.fromEntries(
    Object.entries(storedValues).filter(([, value]) => value?.trim())
  );

  logger.info("Prepared demo command environment", {
    demoId: demo.id,
    actionKeys: Object.keys(envOverrides),
    mongodbTarget: summarizeMongoTarget(envOverrides.MONGODB_URI)
  });

  return {
    DEMO_RUNTIME_URL: env.demoRuntimeUrl,
    DEMO_ID: demo.id,
    ...envOverrides
  };
}

function summarizeMongoTarget(uri = "") {
  if (!uri) {
    return null;
  }

  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/?]+)/i);
  const userMatch = uri.match(/^mongodb(?:\+srv)?:\/\/([^:@/]+)(?::[^@]+)?@/i);

  return {
    host: match?.[1] ?? null,
    user: userMatch?.[1] ?? null
  };
}

function markDemoState(demoId, patch) {
  return telemetryStore.setDemoState(demoId, {
    lastUpdatedAt: new Date().toISOString(),
    ...patch
  });
}

export function isDemoRunning(demoId) {
  return runningProcesses.has(demoId);
}

export function getRunningDemoProcess(demoId) {
  return runningProcesses.get(demoId) ?? null;
}

export async function runOneShotDemoCommand(demo, actionName) {
  const command = demo.commands?.[actionName];

  if (!command) {
    const error = new Error(`No '${actionName}' command configured for demo '${demo.id}'.`);
    error.code = "DEMO_COMMAND_MISSING";
    throw error;
  }

  await ensureRepoExists(demo.repoPath);

  const secrets = await getSecretsForRedaction();
  const envOverrides = await getDemoCommandEnv(demo);

  if (!envOverrides.MONGODB_URI) {
    const error = new Error(
      "MONGODB_URI is missing for this demo command. Open Credentials and save your MongoDB connection string first."
    );
    error.code = "DEMO_CONFIG_MISSING";
    error.credentialKeys = ["MONGODB_URI"];
    throw error;
  }

  await syncDemoEnvFile(demo.repoPath, envOverrides);

  telemetryStore.append({
    demoId: demo.id,
    type: "command-status",
    message: `Running '${actionName}' for ${demo.name}`,
    data: {
      command,
      cwd: demo.repoPath,
      mongodbTarget: summarizeMongoTarget(envOverrides.MONGODB_URI)
    }
  });

  const child = spawnCommand({
    command,
    cwd: demo.repoPath,
    shell: true,
    envOverrides,
    onStdout: (chunk) => {
      appendStreamOutput({
        demoId: demo.id,
        level: "info",
        chunk,
        secrets
      });
    },
    onStderr: (chunk) => {
      appendStreamOutput({
        demoId: demo.id,
        level: "warn",
        chunk,
        secrets
      });
    }
  });

  const result = await waitForExit(child);

  if (result.code !== 0) {
    markDemoState(demo.id, {
      lastError: `${actionName} exited with code ${result.code ?? "unknown"}`
    });

    throw new Error(`${actionName} failed with exit code ${result.code ?? "unknown"}.`);
  }

  markDemoState(demo.id, {
    lastError: null
  });

  telemetryStore.append({
    demoId: demo.id,
    type: "command-status",
    message: `Finished '${actionName}' for ${demo.name}`,
    data: result
  });

  return result;
}

export async function startDemo(demo) {
  if (runningProcesses.has(demo.id)) {
    return {
      alreadyRunning: true,
      process: runningProcesses.get(demo.id)
    };
  }

  const command = demo.commands?.start;

  if (!command) {
    throw new Error(`No 'start' command configured for demo '${demo.id}'.`);
  }

  await ensureRepoExists(demo.repoPath);

  const secrets = await getSecretsForRedaction();
  const envOverrides = await getDemoCommandEnv(demo);
  let sawPortConflict = false;

  await syncDemoEnvFile(demo.repoPath, envOverrides);

  telemetryStore.append({
    demoId: demo.id,
    type: "command-status",
    message: `Starting ${demo.name}`,
    data: {
      command,
      cwd: demo.repoPath,
      mongodbTarget: summarizeMongoTarget(envOverrides.MONGODB_URI)
    }
  });

  const child = spawnCommand({
    command,
    cwd: demo.repoPath,
    shell: true,
    envOverrides,
    onStdout: (chunk) => {
      appendStreamOutput({
        demoId: demo.id,
        level: "info",
        chunk,
        secrets
      });
    },
    onStderr: (chunk) => {
      if (isPortConflict(chunk)) {
        sawPortConflict = true;
      }

      appendStreamOutput({
        demoId: demo.id,
        level: "warn",
        chunk,
        secrets
      });
    },
    onError: (error) => {
      markDemoState(demo.id, {
        status: "error",
        lastError: error.message
      });
    },
    onExit: ({ code, signal }) => {
      runningProcesses.delete(demo.id);
      markDemoState(demo.id, {
        status: code === 0 ? "ready" : "error",
        lastExitCode: code,
        lastSignal: signal ?? null,
        lastError:
          code === 0
            ? null
            : sawPortConflict
              ? "The demo port is already in use."
              : `Demo exited with code ${code ?? "unknown"}`
      });

      telemetryStore.append({
        demoId: demo.id,
        type: "command-status",
        level: code === 0 ? "info" : "error",
        message:
          code === 0
            ? `${demo.name} stopped`
            : sawPortConflict
              ? `${demo.name} failed because its port is already in use`
              : `${demo.name} exited unexpectedly`,
        data: {
          code,
          signal
        }
      });
    }
  });

  const processInfo = {
    pid: child.pid,
    command,
    startedAt: new Date().toISOString()
  };

  runningProcesses.set(demo.id, {
    ...processInfo,
    child
  });

  markDemoState(demo.id, {
    status: "running",
    lastStartedAt: processInfo.startedAt,
    lastError: null
  });

  return processInfo;
}

export async function stopDemo(demoId) {
  const processInfo = runningProcesses.get(demoId);

  if (!processInfo) {
    return {
      stopped: false,
      reason: "not-running"
    };
  }

  processInfo.child.kill("SIGTERM");

  telemetryStore.append({
    demoId: demoId,
    type: "command-status",
    message: `Stop signal sent to demo process ${processInfo.pid}`
  });

  return {
    stopped: true,
    pid: processInfo.pid
  };
}

async function waitForProcessToStop(processInfo, timeoutMs = 12000) {
  if (!processInfo?.child || processInfo.child.exitCode !== null) {
    return;
  }

  await Promise.race([
    waitForExit(processInfo.child),
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error("Timed out waiting for the demo process to stop."));
      }, timeoutMs);
    })
  ]);
}

export async function restartDemo(demo) {
  const processInfo = runningProcesses.get(demo.id);

  if (processInfo) {
    await stopDemo(demo.id);
    await waitForProcessToStop(processInfo);
  }

  return startDemo(demo);
}

export async function reloadRunningLlmDemos() {
  const { loadDemoManifests } = await import("../config/demos.js");
  const demos = await loadDemoManifests();
  const results = [];

  for (const demo of demos) {
    if (!demo.requiredEnv?.includes("GROVE_API_KEY")) {
      continue;
    }

    const reloadUrl = demo.actionsEndpoint?.replace(/\/actions$/, "/reload-credentials");

    if (reloadUrl) {
      try {
        const response = await fetch(reloadUrl, { method: "POST" });
        const payload = await response.json().catch(() => ({}));

        if (response.ok) {
          results.push({
            demoId: demo.id,
            action: "reload",
            ...payload
          });
          continue;
        }
      } catch (error) {
        logger.warn("Hot credential reload failed", {
          demoId: demo.id,
          message: error.message
        });
      }
    }

    if (!isDemoRunning(demo.id)) {
      continue;
    }

    try {
      await restartDemo(demo);
      results.push({
        demoId: demo.id,
        action: "restart"
      });
    } catch (error) {
      logger.warn("Demo restart after credential save failed", {
        demoId: demo.id,
        message: error.message
      });
      results.push({
        demoId: demo.id,
        action: "restart-failed",
        error: error.message
      });
    }
  }

  return results;
}
