const inferredApiBaseUrl =
  typeof window === "undefined"
    ? "http://127.0.0.1:4000/api"
    : `${window.location.protocol}//${window.location.hostname}:4000/api`;

const apiBaseUrl = import.meta.env.VITE_API_URL ?? inferredApiBaseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error ?? `Request failed with status ${response.status}`);
    error.code = payload.code ?? null;
    error.credentialKeys = payload.credentialKeys ?? [];
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function fetchDemos() {
  return request("/demos");
}

export function runDemoAction(id, action) {
  return request(`/demos/${id}/${action}`, {
    method: "POST"
  });
}

export function fetchDemoActions(id) {
  return request(`/demos/${id}/actions`);
}

export function startCluster(clusterName) {
  return request("/clusters/start", {
    method: "POST",
    body: JSON.stringify({ clusterName })
  });
}

export function fetchTelemetry(limit = 200) {
  return request(`/telemetry?limit=${limit}`);
}

export function clearTelemetry() {
  return request("/telemetry", {
    method: "DELETE"
  });
}

export function storeCredentials(values) {
  return request("/credentials", {
    method: "POST",
    body: JSON.stringify({ values })
  });
}

export function testLlm(prompt) {
  return request("/llm/test", {
    method: "POST",
    body: JSON.stringify({ prompt })
  });
}

export function testEmbeddings(text) {
  return request("/embeddings/test", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}
