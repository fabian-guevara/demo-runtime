const inferredApiBaseUrl =
  typeof window === "undefined"
    ? "http://127.0.0.1:4002/api"
    : `${window.location.protocol}//${window.location.hostname}:4002/api`;

const apiBaseUrl = import.meta.env.VITE_API_URL || inferredApiBaseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with status ${response.status}`);
    error.source = payload.source || "application";
    error.category = payload.category || "request";
    error.operation = payload.operation || "unknown";
    error.code = payload.code || null;
    error.hint = payload.hint || "";
    error.requestId = payload.requestId || null;
    error.details = payload.details || {};
    throw error;
  }

  return payload;
}

export function runQuery(question) {
  return request("/query", {
    method: "POST",
    body: JSON.stringify({ question })
  });
}

export function fetchSchema() {
  return request("/schema");
}

export function fetchQueryRuns() {
  return request("/query-runs");
}

export function seedDemo() {
  return request("/seed", {
    method: "POST"
  });
}

export function fetchDemoActions() {
  return request("/demo/actions");
}
