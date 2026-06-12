function formatCurrency(value) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return `$${value.toLocaleString()}`;
}

export default function MetricsCard({ metrics, loading = false }) {
  if (!metrics) {
    return (
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Analytics</p>
            <h2>Metrics</h2>
          </div>
        </div>
        <p className="panel__empty">
          {loading
            ? "Loading MongoDB analytics for this question..."
            : (
              <>
                Run <strong>Show churn risk for Texas enterprise accounts</strong> to load the main metrics story,
                then use <strong>Now compare that to last month</strong> for the comparison view.
              </>
              )}
        </p>
      </section>
    );
  }

  const isComparison = Boolean(metrics.current && metrics.previous);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Analytics</p>
          <h2>{isComparison ? "Comparison metrics" : "Current metrics"}</h2>
        </div>
        {metrics.region && metrics.segment ? (
          <p className="metrics-card__scope">
            {metrics.region} · {metrics.segment}
            {metrics.month ? ` · ${metrics.month}` : metrics.currentMonth ? ` · ${metrics.currentMonth}` : ""}
          </p>
        ) : null}
      </div>

      <div className="metric-grid">
        {isComparison ? (
          <>
            <div className="metric-card">
              <span>Current score</span>
              <strong>{metrics.current.avgChurnRiskScore}</strong>
            </div>
            <div className="metric-card">
              <span>Previous score</span>
              <strong>{metrics.previous.avgChurnRiskScore}</strong>
            </div>
            <div className="metric-card">
              <span>Delta</span>
              <strong>{metrics.delta}</strong>
            </div>
            <div className="metric-card">
              <span>Interpretation</span>
              <strong>{metrics.interpretation}</strong>
            </div>
          </>
        ) : (
          <>
            <div className="metric-card">
              <span>Avg churn risk</span>
              <strong>{metrics.avgChurnRiskScore}</strong>
            </div>
            <div className="metric-card">
              <span>Revenue at risk</span>
              <strong>{formatCurrency(metrics.totalRevenueAtRisk)}</strong>
            </div>
            <div className="metric-card">
              <span>Avg NPS</span>
              <strong>{metrics.avgNps}</strong>
            </div>
            <div className="metric-card">
              <span>Top drivers</span>
              <strong>{metrics.topRiskDrivers?.join(", ")}</strong>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
