function formatJoin(join) {
  return `${join.sourceTable}.${join.sourceColumn} -> ${join.targetTable}.${join.targetColumn}`;
}

export default function QueryPlanView({ result }) {
  if (!result) {
    return (
      <section className="panel panel--focus">
        <p className="panel__eyebrow">Query plan</p>
        <h2>Run the agent to build a metadata-driven plan</h2>
        <p className="panel__empty">
          This demo surfaces retrieved table nodes, relationship edges, join paths, generated SQL, and an operational MongoDB alternative model.
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      <article className="panel panel--focus">
        <div className="panel__heading">
          <div>
            <p className="panel__eyebrow">Plan</p>
            <h2>{result.queryPlan.intent}</h2>
            <div className="badge-row">
              <span className="badge">Retrieval: {result.debug.retrievalMode}</span>
              <span className="badge">LLM: {result.debug.llmMode}</span>
            </div>
          </div>
        </div>

        <p className="lead">{result.explanation}</p>

        <div className="plan-grid">
          <div className="plan-card">
            <h3>Selected tables</h3>
            <ul>
              {result.queryPlan.tables.map((table) => (
                <li key={table.tableName}>
                  <strong>{table.schemaName}.{table.tableName}</strong>
                  <span>{table.reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="plan-card">
            <h3>Join path</h3>
            <ul>
              {result.queryPlan.joins.map((join) => (
                <li key={formatJoin(join)}>
                  <strong>{formatJoin(join)}</strong>
                  <span>{join.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="plan-card">
            <h3>Filters</h3>
            <ul>
              {result.queryPlan.filters.map((filter) => (
                <li key={filter}>{filter}</li>
              ))}
            </ul>
          </div>
          <div className="plan-card">
            <h3>Metrics</h3>
            <ul>
              {result.queryPlan.metrics.map((metric) => (
                <li key={metric}>{metric}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      <article className="panel">
        <p className="panel__eyebrow">MongoDB alternative</p>
        <h2>{result.mongoAlternative.collection}</h2>
        <p className="lead">{result.mongoAlternative.reason}</p>
        <pre className="json-block">{JSON.stringify(result.mongoAlternative.documentShape, null, 2)}</pre>
      </article>
    </section>
  );
}
