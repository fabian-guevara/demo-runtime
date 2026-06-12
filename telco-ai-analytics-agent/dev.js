import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function startWorkspace(name, workspace) {
  const child = spawn(npmCommand, ["run", "dev", "--workspace", workspace], {
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
      return;
    }

    if (code && code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

const children = [
  startWorkspace("server", "server"),
  startWorkspace("client", "client")
];

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
