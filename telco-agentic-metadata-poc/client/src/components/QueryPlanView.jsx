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

  return `${label}: ${mode.replaceAll("_", " ")}`;
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

  const plan = result.plan ?? result.queryPlan ?? {};
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

        <p className="lead">{result.answer || result.explanation}</p>

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
            <h3>Filters</h3>
            <ul>
              {(plan.filters ?? []).length === 0 ? (
                <li>No validated filters yet.</li>
              ) : (
                plan.filters.map((filter) => (
                  <li key={typeof filter === "string" ? filter : filter.expression}>
                    {typeof filter === "string" ? filter : filter.expression}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="plan-card">
            <h3>Metrics</h3>
            <ul>
              {(plan.metrics ?? []).length === 0 ? (
                <li>No validated metrics yet.</li>
              ) : (
                plan.metrics.map((metric) => (
                  <li key={typeof metric === "string" ? metric : metric.name}>
                    {typeof metric === "string" ? metric : metric.expression}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </article>

      <article className="panel">
        <p className="panel__eyebrow">MongoDB alternative</p>
        <h2>{result.mongodbAlternative?.collections?.[0] || result.mongoAlternative?.collection || "Operational read model"}</h2>
        <p className="lead">
          {result.mongodbAlternative?.summary || result.mongoAlternative?.reason || "MongoDB can serve repeated operational read patterns from denormalized documents."}
        </p>
        <pre className="json-block">
          {JSON.stringify(
            result.mongodbAlternative?.pipelineSketch ||
              result.mongoAlternative?.documentShape ||
              result.mongodbAlternative?.collections ||
              {},
            null,
            2
          )}
        </pre>
      </article>
    </section>
  );
}
