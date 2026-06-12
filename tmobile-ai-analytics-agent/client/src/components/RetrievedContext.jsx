export default function RetrievedContext({ context }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Vector Search</p>
          <h2>Retrieved context{context.length ? ` (${context.length})` : ""}</h2>
        </div>
      </div>

      {context.length === 0 ? (
        <p className="panel__empty">
          This fills in after a churn-risk or evidence question. Try <strong>Show churn risk for Texas enterprise accounts</strong> or <strong>What evidence supports that?</strong>
        </p>
      ) : null}

      <div className="context-list">
        {context.map((item, index) => (
          <article key={`${item.sourceType}-${index}`} className="context-card">
            <div className="context-card__meta">
              <span>{item.sourceType}</span>
              <span>score {item.score}</span>
            </div>
            <p>{item.summary}</p>
            {item.accountName ? <small>Account: {item.accountName}</small> : null}
            {item.createdAt ? <small>Created: {new Date(item.createdAt).toLocaleString()}</small> : null}
            {item.resolutionStatus ? <small>Status: {item.resolutionStatus}</small> : null}
            {item.rootCause ? <small>Root cause: {item.rootCause}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
