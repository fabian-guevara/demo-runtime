const inferredApiBaseUrl =
  typeof window === "undefined"
    ? "http://127.0.0.1:4003/api"
    : `${window.location.protocol}//${window.location.hostname}:4003/api`;

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== "undefined" && window.location.port === "5178" ? "/api" : inferredApiBaseUrl);

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error ?? `Request failed (${response.status})`);
    error.code = payload.code;
    throw error;
  }

  return payload;
}

export function fetchConfig() {
  return request("/config");
}

export function saveConfig(values) {
  return request("/config", {
    method: "PUT",
    body: JSON.stringify(values)
  });
}

export function fetchTowerMap() {
  return request("/towers/map");
}

export function sendChat(message, sessionId) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ message, sessionId })
  });
}

export function seedDemo() {
  return request("/seed", { method: "POST" });
}

export function fetchActions() {
  return request("/demo/actions");
}

export function fetchSimulatorStatus() {
  return request("/simulator/status");
}

export function startSimulator(options = {}) {
  return request("/simulator/start", {
    method: "POST",
    body: JSON.stringify(options)
  });
}

export function stopSimulator() {
  return request("/simulator/stop", { method: "POST" });
}

export function injectErrors() {
  return request("/simulator/inject-errors", { method: "POST" });
}

export function setAllHealthy() {
  return request("/towers/all-healthy", { method: "POST" });
}
