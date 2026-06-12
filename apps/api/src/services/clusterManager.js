import telemetryStore from "./telemetryStore.js";
import { getSecretsForRedaction } from "./credentialManager.js";
import { spawnCommand, splitOutputLines, waitForExit } from "../utils/shell.js";
import { redactSecretsInText } from "../utils/redact.js";

function appendClusterOutput(clusterName, chunk, level, secrets) {
  for (const line of splitOutputLines(chunk)) {
    telemetryStore.append({
      type: "cluster-output",
      level,
      message: redactSecretsInText(line, secrets),
      data: {
        clusterName
      }
    });
  }
}

export async function startCluster(clusterName) {
  if (!clusterName) {
    throw new Error("clusterName is required.");
  }

  telemetryStore.setClusterState(clusterName, {
    status: "starting",
    lastUpdatedAt: new Date().toISOString()
  });

  telemetryStore.append({
    type: "cluster-status",
    message: `Starting Atlas cluster '${clusterName}' with local start-cluster command`
  });

  const secrets = await getSecretsForRedaction();

  const child = spawnCommand({
    command: "start-cluster",
    args: [clusterName],
    shell: false,
    onStdout: (chunk) => {
      appendClusterOutput(clusterName, chunk, "info", secrets);
    },
    onStderr: (chunk) => {
      appendClusterOutput(clusterName, chunk, "warn", secrets);
    }
  });

  const result = await waitForExit(child).catch((error) => {
    telemetryStore.setClusterState(clusterName, {
      status: "error",
      lastError: error.message,
      lastUpdatedAt: new Date().toISOString()
    });
    throw error;
  });

  if (result.code !== 0) {
    telemetryStore.setClusterState(clusterName, {
      status: "error",
      lastError: `start-cluster exited with code ${result.code ?? "unknown"}`,
      lastUpdatedAt: new Date().toISOString()
    });

    throw new Error(
      result.code === null
        ? "start-cluster did not complete."
        : `start-cluster failed with exit code ${result.code}.`
    );
  }

  telemetryStore.setClusterState(clusterName, {
    status: "ready",
    lastError: null,
    lastUpdatedAt: new Date().toISOString()
  });

  telemetryStore.append({
    type: "cluster-status",
    message: `Cluster '${clusterName}' is ready`
  });

  return {
    clusterName,
    status: "ready"
  };
}
