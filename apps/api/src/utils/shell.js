import { spawn } from "node:child_process";

export function spawnCommand({
  command,
  args = [],
  cwd,
  envOverrides = {},
  shell = false,
  onStdout,
  onStderr,
  onExit,
  onError
}) {
  const child = spawn(command, args, {
    cwd,
    shell,
    env: {
      ...process.env,
      ...envOverrides
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => {
    onStdout?.(chunk.toString());
  });

  child.stderr?.on("data", (chunk) => {
    onStderr?.(chunk.toString());
  });

  child.on("exit", (code, signal) => {
    onExit?.({ code, signal });
  });

  child.on("error", (error) => {
    onError?.(error);
  });

  return child;
}

export function waitForExit(child) {
  return new Promise((resolve, reject) => {
    let handled = false;

    child.on("error", (error) => {
      if (handled) {
        return;
      }

      handled = true;
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (handled) {
        return;
      }

      handled = true;
      resolve({ code, signal });
    });
  });
}

export function splitOutputLines(chunk) {
  return chunk
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

export function isPortConflict(output) {
  return /eaddrinuse|address already in use|port .* already in use/i.test(output);
}
