export default function QueryRunsPanel({ runs }) {
  return (
    <section className="panel">
      <div className="panel__heading">
        <div>
          <p className="panel__eyebrow">Previous runs</p>
          <h2>Saved query runs</h2>
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="panel__empty">No runs stored yet.</p>
      ) : (
        <div className="run-list">
          {runs.map((run) => (
            <article key={JSON.stringify(run._id)} className="run-card">
              <strong>{run.question}</strong>
              <span>{run.plan?.intent || run.queryPlan?.intent}</span>
              <small>
                {run.debug?.retrievalMode} / {run.debug?.llmMode} / {run.plan?.isValid === false ? "invalid plan" : "valid plan"}
              </small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
