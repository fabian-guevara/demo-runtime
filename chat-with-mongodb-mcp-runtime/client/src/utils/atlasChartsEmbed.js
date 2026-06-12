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
    if (/localhost|127\.0\.0\.1/i.test(url.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function resolveAtlasChartsEmbedUrl(rawUrl, { baseUrl, chartId } = {}) {
  const built = buildAtlasChartsEmbedUrl(baseUrl, chartId);
  if (built && isValidAtlasChartsEmbedUrl(built)) {
    return withChartRefreshParams(built);
  }

  const raw = rawUrl?.trim();
  if (raw && isValidAtlasChartsEmbedUrl(raw)) {
    return withChartRefreshParams(raw);
  }

  return "";
}

function withChartRefreshParams(raw) {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("autoRefresh")) {
      url.searchParams.set("autoRefresh", "true");
    }
    if (!url.searchParams.has("maxDataAge")) {
      url.searchParams.set("maxDataAge", "10");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function parseAtlasChartsEmbedUrl(embedUrl) {
  if (!isValidAtlasChartsEmbedUrl(embedUrl)) {
    return { baseUrl: "", chartId: "", embedUrl: "" };
  }

  try {
    const url = new URL(embedUrl.trim());
    const chartId = url.searchParams.get("id") ?? "";
    const baseUrl = `${url.origin}${url.pathname.replace(/\/embed\/.*$/, "")}`;
    return { baseUrl, chartId, embedUrl: embedUrl.trim() };
  } catch {
    return { baseUrl: "", chartId: "", embedUrl: "" };
  }
}
