export function buildAtlasChartsEmbedUrl(baseUrl, chartId) {
  const base = baseUrl?.trim().replace(/\/$/, "");
  const id = chartId?.trim();
  if (!base || !id) {
    return "";
  }

  return `${base}/embed/charts?id=${encodeURIComponent(id)}`;
}

export function isValidAtlasChartsEmbedUrl(raw) {
  if (!raw?.trim()) {
    return false;
  }

  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") {
      return false;
    }
    if (url.hostname !== "charts.mongodb.com") {
      return false;
    }
    if (!url.pathname.includes("/embed/")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeAtlasChartsEmbedUrl(raw) {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  if (!isValidAtlasChartsEmbedUrl(trimmed)) {
    throw new Error(
      "Atlas Charts embed URL must be https://charts.mongodb.com/.../embed/... (not localhost or base URL alone)."
    );
  }

  return trimmed;
}
