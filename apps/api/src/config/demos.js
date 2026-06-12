import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import env from "./env.js";

function normalizeManifest(rawManifest, manifestPath) {
  const repoPath = resolve(env.rootDir, rawManifest.repoPath ?? ".");

  return {
    id: rawManifest.id ?? basename(manifestPath, ".json"),
    name: rawManifest.name ?? rawManifest.id,
    description: rawManifest.description ?? "",
    repoPath,
    clusterName: rawManifest.clusterName ?? "",
    requiredEnv: rawManifest.requiredEnv ?? [],
    commands: rawManifest.commands ?? {},
    actionsEndpoint: rawManifest.actionsEndpoint ?? null,
    appUrl: rawManifest.appUrl ?? null,
    memory: rawManifest.memory ?? null,
    eyebrow: rawManifest.eyebrow ?? "",
    mongoStack: rawManifest.mongoStack ?? "",
    manifestPath
  };
}

export async function loadDemoManifests() {
  const files = await readdir(env.demosDir);
  const manifestFiles = files.filter((file) => file.endsWith(".json")).sort();

  const manifests = await Promise.all(
    manifestFiles.map(async (file) => {
      const manifestPath = resolve(env.demosDir, file);
      const contents = await readFile(manifestPath, "utf8");
      return normalizeManifest(JSON.parse(contents), manifestPath);
    })
  );

  return manifests;
}

export async function loadDemoManifestById(id) {
  const manifests = await loadDemoManifests();
  return manifests.find((manifest) => manifest.id === id) ?? null;
}
