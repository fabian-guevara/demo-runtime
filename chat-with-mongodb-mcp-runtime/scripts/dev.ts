import { spawn } from "node:child_process";

const root = new URL("../", import.meta.url);

function run(label: string, command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
}

const api = run("api", "npm", ["run", "dev:api"]);
const web = run("web", "npm", ["run", "dev:web"]);

function shutdown(signal: NodeJS.Signals) {
  api.kill(signal);
  web.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
