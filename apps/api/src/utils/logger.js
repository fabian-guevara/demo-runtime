import telemetryStore from "../services/telemetryStore.js";
import { sanitizeObject } from "./redact.js";

function write(level, message, data = null) {
  const safeData = data ? sanitizeObject(data) : null;

  telemetryStore.append({
    level,
    type: "runtime-log",
    message,
    data: safeData
  });

  const consoleMethod =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (safeData) {
    consoleMethod(`[${level}] ${message}`, safeData);
    return;
  }

  consoleMethod(`[${level}] ${message}`);
}

const logger = {
  info(message, data) {
    write("info", message, data);
  },
  warn(message, data) {
    write("warn", message, data);
  },
  error(message, data) {
    write("error", message, data);
  },
  debug(message, data) {
    write("debug", message, data);
  }
};

export default logger;
