import { Router } from "express";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import env from "../config/env.js";
import { loadDemoManifestById, loadDemoManifests } from "../config/demos.js";
import { getMissingEnvVars, getStoredCredentialValues } from "../services/credentialManager.js";
import { readGroveModel } from "../services/groveClient.js";
import { validateDemoBeforeStart } from "../services/demoPreflight.js";
import telemetryStore from "../services/telemetryStore.js";
import {
  getRunningDemoProcess,
  isDemoRunning,
  restartDemo,
  runOneShotDemoCommand,
  startDemo,
  stopDemo
} from "../services/demoRunner.js";

const router = Router();

async function repoExists(repoPath) {
  try {
    await access(repoPath);
    return true;
  } catch {
    return false;
  }
}

function getStatus({ demo, demoState, missingEnv, running, repoExistsFlag, clusterState }) {
  if (missingEnv.length > 0) {
    return "Not configured";
  }

  if (!repoExistsFlag) {
    return "Error";
  }

  if (demoState.lastError) {
    return "Error";
  }

  if (running) {
    return "Running";
  }

  if (clusterState.status === "paused") {
    return "Cluster paused";
  }

  return "Ready";
}

async function serializeDemo(demo) {
  const missingEnv = await getMissingEnvVars(demo.requiredEnv);
  const configuredValues = await getStoredCredentialValues(demo.requiredEnv);
  const demoState = telemetryStore.getDemoState(demo.id);
  const clusterState = telemetryStore.getClusterState(demo.clusterName);
  const running = isDemoRunning(demo.id);
  const processInfo = getRunningDemoProcess(demo.id);
  const repoExistsFlag = await repoExists(demo.repoPath);

  return {
    ...demo,
    repoExists: repoExistsFlag,
    missingEnv,
    configuredValues,
    process: running && processInfo
      ? {
          pid: processInfo.pid,
          command: processInfo.command,
          startedAt: processInfo.startedAt
        }
      : null,
    status: getStatus({
      demo,
      demoState,
      missingEnv,
      running,
      repoExistsFlag,
      clusterState
    }),
    clusterState: clusterState.status ?? "unknown",
    lastError: demoState.lastError ?? null,
    lastStartedAt: demoState.lastStartedAt ?? null
  };
}

async function getActionsFromEndpoint(demo) {
  if (!demo.actionsEndpoint) {
    return [];
  }

  const response = await fetch(demo.actionsEndpoint);

  if (!response.ok) {
    throw new Error(`Actions endpoint returned ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.actions ?? [];
}

async function getDemoActions(demo) {
  const cached = telemetryStore.getDemoActions(demo.id, 20);
  if (cached.length > 0) {
    return cached;
  }

  try {
    const remoteActions = await getActionsFromEndpoint(demo);
    remoteActions.forEach((action) => telemetryStore.appendDemoAction(demo.id, action));
    return telemetryStore.getDemoActions(demo.id, 20);
  } catch {
    const localActions = await telemetryStore.readLocalDemoTelemetry(demo.repoPath, 20);
    localActions.forEach((action) => telemetryStore.appendDemoAction(demo.id, action));
    return telemetryStore.getDemoActions(demo.id, 20);
  }
}

async function withDemo(req, res, next) {
  const demo = await loadDemoManifestById(req.params.id);

  if (!demo) {
    res.status(404).json({
      error: `Unknown demo '${req.params.id}'.`
    });
    return;
  }

  req.demo = demo;
  next();
}

function sendDemoError(res, error) {
  res.status(400).json({
    error: error.message,
    code: error.code ?? "DEMO_REQUEST_FAILED",
    credentialKeys: error.credentialKeys ?? []
  });
}

router.get("/", async (_req, res) => {
  const demos = await loadDemoManifests();
  const serialized = await Promise.all(demos.map((demo) => serializeDemo(demo)));
  res.json({
    demos: serialized
  });
});

router.post("/:id/setup", withDemo, async (req, res) => {
  try {
    const result = await runOneShotDemoCommand(req.demo, "setup");
    res.json({ ok: true, result });
  } catch (error) {
    sendDemoError(res, error);
  }
});

router.post("/:id/seed", withDemo, async (req, res) => {
  try {
    const result = await runOneShotDemoCommand(req.demo, "seed");
    res.json({ ok: true, result });
  } catch (error) {
    sendDemoError(res, error);
  }
});

router.post("/:id/start", withDemo, async (req, res) => {
  try {
    await validateDemoBeforeStart(req.demo);
    const result = await startDemo(req.demo);
    res.json({ ok: true, result });
  } catch (error) {
    sendDemoError(res, error);
  }
});

router.post("/:id/reset", withDemo, async (req, res) => {
  try {
    const result = await runOneShotDemoCommand(req.demo, "reset");
    res.json({ ok: true, result });
  } catch (error) {
    sendDemoError(res, error);
  }
});

router.post("/:id/stop", withDemo, async (req, res) => {
  try {
    const result = await stopDemo(req.demo.id);
    res.json({ ok: true, result });
  } catch (error) {
    sendDemoError(res, error);
  }
});

router.post("/:id/restart", withDemo, async (req, res) => {
  try {
    await validateDemoBeforeStart(req.demo);
    const result = await restartDemo(req.demo);
    res.json({ ok: true, result });
  } catch (error) {
    sendDemoError(res, error);
  }
});

router.get("/:id/actions", withDemo, async (req, res) => {
  try {
    const actions = await getDemoActions(req.demo);
    res.json({ actions });
  } catch (error) {
    sendDemoError(res, error);
  }
});

function renderArchitectureHtml(html, llmModel) {
  const defaultModel = "gpt-5.5";
  const resolvedModel = llmModel?.trim() || defaultModel;

  if (resolvedModel === defaultModel) {
    return html.replace(/\{\{LLM_MODEL\}\}/g, defaultModel);
  }

  return html.replace(/\{\{LLM_MODEL\}\}/g, resolvedModel).replace(/gpt-5\.5/g, resolvedModel);
}

router.get("/:id/architecture", withDemo, async (req, res) => {
  const architecturePath = resolve(env.demosDir, "architecture", `${req.demo.id}.html`);
  const credentials = await getStoredCredentialValues(["GROVE_MODEL"]);
  const llmModel = credentials.GROVE_MODEL?.trim() || readGroveModel();

  try {
    const html = renderArchitectureHtml(await readFile(architecturePath, "utf8"), llmModel);
    res.type("html").send(html);
  } catch {
    res.status(404).type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture not found</title>
  </head>
  <body>
    <h1>Architecture page not found</h1>
    <p>No architecture document exists yet for demo <code>${req.demo.id}</code>.</p>
  </body>
</html>`);
  }
});

export default router;
