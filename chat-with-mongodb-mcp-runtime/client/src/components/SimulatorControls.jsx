export default function SimulatorControls({ status, onStart, onStop, onInject, onAllHealthy, onSeed, busy }) {
  return (
    <section className="panel panel--compact">
      <p className="panel__eyebrow">Live telemetry</p>
      <h2>Tower simulator</h2>
      <p className="panel__copy">
        Streams synthetic logs into <code>realtime_network_logs</code> and refreshes{" "}
        <code>tower_health</code>. Atlas Charts refreshes every ~10s when embedded.
      </p>
      <div className="button-row">
        <button type="button" className="button button--primary" disabled={busy || status.running} onClick={onStart}>
          Start stream
        </button>
        <button type="button" className="button button--ghost" disabled={busy || !status.running} onClick={onStop}>
          Stop
        </button>
        <button type="button" className="button button--ghost" disabled={busy} onClick={onInject}>
          Inject errors
        </button>
        <button type="button" className="button button--ghost" disabled={busy} onClick={onAllHealthy}>
          All healthy
        </button>
        <button type="button" className="button button--ghost" disabled={busy} onClick={onSeed}>
          Seed demo
        </button>
      </div>
      <div className="status-grid">
        <div>
          <span>Status</span>
          <strong>{status.running ? "Running" : "Stopped"}</strong>
        </div>
        <div>
          <span>Batch size</span>
          <strong>{status.documentsPerBatch}</strong>
        </div>
        <div>
          <span>Interval</span>
          <strong>{Math.round(status.intervalMs / 1000)}s</strong>
        </div>
      </div>
    </section>
  );
}
