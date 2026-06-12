import { sanitizeObject } from "./redact.js";

function write(level, message, data) {
  const safeData = data ? sanitizeObject(data) : undefined;
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (safeData !== undefined) {
    method(`[${level}] ${message}`, safeData);
    return;
  }

  method(`[${level}] ${message}`);
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
  }
};

export default logger;
