const inferredApiBaseUrl =
  typeof window === "undefined"
    ? "http://127.0.0.1:4004/api"
    : `${window.location.protocol}//${window.location.hostname}:4004/api`;

const API_BASE =
  import.meta.env.VITE_API_URL ??
  (typeof window !== "undefined" && window.location.port === "5179" ? "/api" : inferredApiBaseUrl);

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

export function fetchStats() {
  return request("/customers/stats");
}

export function searchCustomers({ q = "", segment = "", limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (segment) params.set("segment", segment);
  params.set("limit", String(limit));
  return request(`/customers/search?${params.toString()}`);
}

export function autocompleteCustomers({ q = "", segment = "", limit = 8 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (segment) params.set("segment", segment);
  params.set("limit", String(limit));
  return request(`/customers/autocomplete?${params.toString()}`);
}

export function fetchCustomerProfile(customerId) {
  return request(`/customers/${encodeURIComponent(customerId)}`);
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

export function fetchHealth() {
  return request("/health");
}
