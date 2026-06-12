import { useEffect, useState } from "react";
import { parseAtlasChartsEmbedUrl, resolveAtlasChartsEmbedUrl } from "../utils/atlasChartsEmbed.js";

export default function ConfigModal({ open, settings, onClose, onSave, saving }) {
  const [mapBaseUrl, setMapBaseUrl] = useState("");
  const [mapChartId, setMapChartId] = useState("");
  const [mapEmbedUrl, setMapEmbedUrl] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const parsed = parseAtlasChartsEmbedUrl(settings?.atlasChartsMarketMapEmbedUrl ?? "");
    setMapBaseUrl(parsed.baseUrl);
    setMapChartId(parsed.chartId);
    setMapEmbedUrl(parsed.embedUrl);
    setDashboardUrl(settings?.atlasChartsDashboardEmbedUrl ?? "");
    setError("");
  }, [settings, open]);

  if (!open) {
    return null;
  }

  const previewUrl = resolveAtlasChartsEmbedUrl(mapEmbedUrl, {
    baseUrl: mapBaseUrl,
    chartId: mapChartId
  });

  function handleSave() {
    const resolvedMapUrl = resolveAtlasChartsEmbedUrl(mapEmbedUrl, {
      baseUrl: mapBaseUrl,
      chartId: mapChartId
    });

    const hasMapInput = Boolean(mapBaseUrl.trim() || mapChartId.trim() || mapEmbedUrl.trim());
    if (hasMapInput && !resolvedMapUrl) {
      setError(
        "Map embed must be a charts.mongodb.com iframe URL, or Base URL + Chart ID from Embed chart (Iframe tab)."
      );
      return;
    }

    onSave({
      atlasChartsMarketMapEmbedUrl: resolvedMapUrl,
      atlasChartsDashboardEmbedUrl: dashboardUrl.trim()
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <p className="panel__eyebrow">Demo config</p>
        <h2>Atlas Charts</h2>
        <p className="modal-card__description">
          Use the <strong>Iframe</strong> tab in Atlas Charts (not Javascript SDK). Paste <strong>Base URL</strong> +{" "}
          <strong>Chart ID</strong>, or the full iframe URL. Must be <code>charts.mongodb.com/.../embed/...</code> — not
          this demo&apos;s localhost URL.
        </p>

        <label className="field">
          <span>Charts base URL</span>
          <input
            value={mapBaseUrl}
            onChange={(event) => {
              setError("");
              setMapBaseUrl(event.target.value);
            }}
            placeholder="https://charts.mongodb.com/charts-your-project"
          />
        </label>

        <label className="field">
          <span>Chart ID</span>
          <input
            value={mapChartId}
            onChange={(event) => {
              setError("");
              setMapChartId(event.target.value);
            }}
            placeholder="1e743fdd-0bf5-419f-911a-11eda33499f1"
          />
        </label>

        <label className="field">
          <span>Or full iframe URL</span>
          <input
            value={mapEmbedUrl}
            onChange={(event) => {
              setError("");
              setMapEmbedUrl(event.target.value);
            }}
            placeholder="https://charts.mongodb.com/charts-your-project/embed/charts?id=..."
          />
        </label>

        {previewUrl ? (
          <p className="field__preview">
            Preview: <code>{previewUrl}</code>
          </p>
        ) : null}

        {error ? <p className="field__error">{error}</p> : null}

        <label className="field">
          <span>Dashboard embed URL (optional)</span>
          <input
            value={dashboardUrl}
            onChange={(event) => setDashboardUrl(event.target.value)}
            placeholder="https://charts.mongodb.com/.../embed/..."
          />
        </label>

        <div className="modal-card__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button button--primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save config"}
          </button>
        </div>
      </div>
    </div>
  );
}
