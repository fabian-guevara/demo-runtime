function formatJoin(join) {
  return `${join.sourceTable}.${join.sourceColumn} -> ${join.targetTable}.${join.targetColumn}`;
}

function badgeClass(mode) {
  if (!mode) {
    return "badge";
  }

  if (mode.includes("degraded") || mode === "unavailable" || mode === "metadata_only") {
    return "badge badge--degraded";
  }

  return "badge badge--healthy";
}

function formatModeLabel(label, mode) {
  if (!mode) {
    return `${label}: unknown`;
  }

  return `${label}: ${String(mode).replaceAll("_", " ")}`;
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

  const plan = result.plan ?? {};
  const debug = result.debug ?? {};
  const governance = result.governance ?? {};

  return (
    <section className="stack">
      <article className="panel panel--focus">
        <div className="panel__heading">
          <div>
            <p className="panel__eyebrow">Plan</p>
            <h2>{plan.intent || "Metadata-grounded query plan"}</h2>
            <div className="badge-row">
              <span className="badge badge--healthy">LLM provider: Grove</span>
              <span className={badgeClass(debug.llmMode)}>
                {formatModeLabel("LLM", debug.llmMode)}
              </span>
              <span className={badgeClass(debug.retrievalMode)}>
                {formatModeLabel("Retrieval", debug.retrievalMode)}
              </span>
              <span className={badgeClass(debug.embeddingMode)}>
                {formatModeLabel("Embedding", debug.embeddingMode)}
              </span>
              <span className={badgeClass(debug.graphMode)}>
                {formatModeLabel("Graph", debug.graphMode)}
              </span>
              <span className={plan.isValid ? "badge badge--healthy" : "badge badge--degraded"}>
                Plan validation: {plan.isValid ? "valid" : "failed"}
              </span>
            </div>
          </div>
        </div>

        <p className="lead">{result.answer}</p>

        {(debug.llmWarnings ?? []).length > 0 && (
          <div className="alert alert--warning">
            <strong>LLM warnings</strong>
            <ul>
              {debug.llmWarnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {!plan.isValid && (
          <div className="alert alert--warning">
            <strong>Cannot answer from available metadata</strong>
            <ul>
              {(plan.validationErrors ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {(governance.policyWarnings ?? []).length > 0 && (
          <div className="alert alert--policy">
            <strong>Policy warnings</strong>
            <ul>
              {governance.policyWarnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="plan-grid">
          <div className="plan-card">
            <h3>Selected tables</h3>
            <ul>
              {(plan.tables ?? []).map((table) => (
                <li key={table.tableName}>
                  <strong>
                    {table.schemaName}.{table.tableName}
                  </strong>
                  <span>{table.reason}</span>
                  <small>confidence {table.confidence ?? "n/a"}</small>
                </li>
              ))}
            </ul>
          </div>
          <div className="plan-card">
            <h3>Join path</h3>
            <ul>
              {(plan.joins ?? []).map((join) => (
                <li key={formatJoin(join)}>
                  <strong>{formatJoin(join)}</strong>
                  <span>{join.description || join.evidence?.[0]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="plan-card">
            <h3>Columns</h3>
            <ul>
              {(plan.columns ?? []).length === 0 ? (
                <li>No validated columns selected.</li>
              ) : (
                plan.columns.map((column) => (
                  <li key={`${column.tableName}.${column.columnName}`}>
                    <strong>
                      {column.tableName}.{column.columnName}
                    </strong>
                    <span>{column.reason}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="plan-card">
            <h3>Assumptions</h3>
            <ul>
              {(plan.assumptions ?? []).length === 0 ? (
                <li>No assumptions recorded.</li>
              ) : (
                plan.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)
              )}
            </ul>
          </div>
        </div>
      </article>

      <article className="panel">
        <p className="panel__eyebrow">MongoDB alternative</p>
        <h2>{result.mongodbAlternative?.collections?.[0] || "Operational read model"}</h2>
        <p className="lead">{result.mongodbAlternative?.summary}</p>
        <pre className="json-block">{JSON.stringify(result.mongodbAlternative?.pipelineSketch ?? [], null, 2)}</pre>
      </article>
    </section>
  );
}
