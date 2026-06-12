function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function badgeClass(mode) {
  if (!mode) {
    return "badge";
  }

  if (mode.includes("degraded") || mode === "unavailable") {
    return "badge badge--degraded";
  }

  return "badge badge--healthy";
}

export default function RetrievedPanel({ result }) {
  if (!result) {
    return (
      <section className="stack">
        <article className="panel">
          <p className="panel__eyebrow">What did we retrieve?</p>
          <h2>Metadata retrieval will appear here</h2>
          <p className="panel__empty">
            The right side shows retrieved table nodes, relationship edges, join path, SQL, and timing details after a run.
          </p>
        </article>
      </section>
    );
  }

  const retrieval = result.retrieval ?? {};
  const graph = result.graph ?? {};
  const debug = result.debug ?? {};
  const tables = retrieval.results ?? [];
  const edges = result.plan?.joins ?? [];

  return (
    <section className="stack">
      <article className="panel">
        <div className="panel__heading">
          <div>
            <p className="panel__eyebrow">Runtime modes</p>
            <h2>Retrieval and graph status</h2>
            <div className="badge-row">
              <span className={badgeClass(retrieval.mode)}>
                Retrieval: {String(retrieval.mode || "unknown").replaceAll("_", " ")}
              </span>
              <span className={badgeClass(debug.embeddingMode)}>
                Embedding: {String(debug.embeddingMode || "unknown").replaceAll("_", " ")}
              </span>
              <span className={badgeClass(graph.mode)}>
                Graph: {String(graph.mode || "unknown").replaceAll("_", " ")}
              </span>
            </div>
          </div>
        </div>
        {(retrieval.warnings ?? []).length > 0 && (
          <div className="alert alert--warning">
            <strong>Retrieval warnings</strong>
            <ul>
              {retrieval.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <article className="panel">
        <div className="panel__heading">
          <div>
            <p className="panel__eyebrow">What did we retrieve?</p>
            <h2>Table nodes</h2>
          </div>
        </div>
        <div className="retrieval-list">
          {tables.map((table) => (
            <article key={table.tableName} className="retrieval-card">
              <div className="retrieval-card__top">
                <strong>
                  {table.schemaName}.{table.tableName}
                </strong>
                <span>score {table.score ?? "n/a"}</span>
              </div>
              <p>{table.businessDescription}</p>
              <small>Rows: {formatNumber(table.rowCount)}</small>
              <small>PKs: {(table.primaryKeys ?? []).join(", ")}</small>
              <small>Tags: {(table.tags ?? []).join(", ")}</small>
            </article>
          ))}
        </div>
      </article>

      <article className="panel">
        <p className="panel__eyebrow">Relationship edges</p>
        <h2>Validated join context</h2>
        <div className="retrieval-list">
          {edges.map((edge, index) => (
            <article
              key={`${edge.sourceTable}-${edge.targetTable}-${edge.sourceColumn}-${index}`}
              className="retrieval-card"
            >
              <div className="retrieval-card__top">
                <strong>
                  {edge.sourceTable}.{edge.sourceColumn} {"->"} {edge.targetTable}.{edge.targetColumn}
                </strong>
                <span>confidence {edge.confidence ?? "n/a"}</span>
              </div>
              <p>{edge.relationshipDescription || edge.description}</p>
            </article>
          ))}
        </div>
      </article>

      <article className="panel">
        <p className="panel__eyebrow">GraphRAG context</p>
        <h2>Entities connected via $graphLookup</h2>
        <div className="retrieval-list">
          {(graph.evidence ?? []).length === 0 ? (
            <p className="panel__empty">No GraphRAG entities returned for this run.</p>
          ) : (
            graph.evidence.map((entity) => (
              <article key={entity.id} className="retrieval-card">
                <div className="retrieval-card__top">
                  <strong>{entity.id}</strong>
                  <span>{entity.type}</span>
                </div>
                <p>{entity.description}</p>
                <small>
                  Linked tables: {(entity.linkedTables ?? []).join(", ") || "see graph evidence"}
                </small>
              </article>
            ))
          )}
        </div>
      </article>

      <article className="panel">
        <p className="panel__eyebrow">Timings</p>
        <h2>Debug timings</h2>
        <div className="timing-grid">
          <div>
            <span>Vector / retrieval</span>
            <strong>{debug.timings?.vectorSearchMs ?? 0} ms</strong>
          </div>
          <div>
            <span>GraphRAG / $graphLookup</span>
            <strong>{debug.timings?.graphTraversalMs ?? 0} ms</strong>
          </div>
          <div>
            <span>Plan generation</span>
            <strong>{debug.timings?.generationMs ?? 0} ms</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{debug.timings?.totalMs ?? 0} ms</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
