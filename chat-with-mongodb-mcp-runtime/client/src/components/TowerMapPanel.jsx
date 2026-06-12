function projectCoordinates(coordinates) {
  const [lng, lat] = coordinates;
  const x = ((lng + 125) / 60) * 100;
  const y = ((50 - lat) / 25) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
}

export default function TowerMapPanel({ towers, chartEmbedUrl, embedWarning }) {
  if (chartEmbedUrl) {
    return (
      <iframe
        className="map-slot__iframe"
        title="Atlas Charts tower map"
        src={chartEmbedUrl}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <>
      {embedWarning ? <p className="map-slot__warning">{embedWarning}</p> : null}

      <div className="map-canvas">
        <svg viewBox="0 0 100 100" className="map-canvas__svg" aria-hidden="true">
          <rect x="0" y="0" width="100" height="100" rx="8" className="map-canvas__bg" />
        </svg>

        {towers.map((tower) => {
          const point = projectCoordinates(tower.coordinates);
          const isBad = tower.mapColor === "red" || tower.maxSeverity >= 4;

          return (
            <button
              key={tower.towerId}
              type="button"
              className={`map-dot${isBad ? " map-dot--bad" : ""}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              title={`${tower.name} · severity ${tower.maxSeverity}`}
            >
              <span>{tower.towerId.replace("tower_", "T")}</span>
            </button>
          );
        })}
      </div>

      <div className="map-legend">
        <span className="map-legend__item">
          <i className="map-dot map-dot--sample map-dot--good" /> Healthy
        </span>
        <span className="map-legend__item">
          <i className="map-dot map-dot--sample map-dot--bad" /> Severity 4+
        </span>
      </div>

      <div className="tower-list">
        {towers.map((tower) => (
          <article key={tower.towerId} className="tower-card">
            <strong>{tower.name}</strong>
            <span>{tower.market}</span>
            <span>{tower.status}</span>
            <small>max severity {tower.maxSeverity}</small>
          </article>
        ))}
      </div>
    </>
  );
}
