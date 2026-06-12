const inferredApiBaseUrl =
  typeof window === "undefined"
    ? "http://127.0.0.1:4001"
    : `${window.location.protocol}//${window.location.hostname}:4001`;

const baseUrl = import.meta.env.VITE_API_URL || inferredApiBaseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload;
}

export function sendChat(body) {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function fetchActions() {
  return request("/api/demo/actions");
}

export function fetchMemories(userId = "demo-user") {
  return request(`/api/memory?userId=${encodeURIComponent(userId)}`);
}

export function storeMemory(body) {
  return request("/api/memory", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function clearMemories(userId = "demo-user") {
  return request(`/api/memory?userId=${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
}

export function resetDemo() {
  return request("/api/demo/reset", {
    method: "POST"
  });
}

export function seedDemo() {
  return request("/api/demo/seed", {
    method: "POST"
  });
}
