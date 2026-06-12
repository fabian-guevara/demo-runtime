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
  const tables = retrieval.results ?? result.retrievedTables ?? [];
  const edges = result.retrievedEdges ?? [];

  return (
    <section className="stack">
      <article className="panel">
        <div className="panel__heading">
          <div>
            <p className="panel__eyebrow">Runtime modes</p>
            <h2>Retrieval and graph status</h2>
            <div className="badge-row">
              <span className={badgeClass(retrieval.mode || result.debug?.retrievalMode)}>
                Retrieval: {(retrieval.mode || result.debug?.retrievalMode || "unknown").replaceAll("_", " ")}
              </span>
              <span className={badgeClass(result.debug?.embeddingMode)}>
                Embedding: {(result.debug?.embeddingMode || "unknown").replaceAll("_", " ")}
              </span>
              <span className={badgeClass(graph.mode || result.debug?.graphMode)}>
                Graph: {(graph.mode || result.debug?.graphMode || "unknown").replaceAll("_", " ")}
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
        <h2>Graph-like join context</h2>
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
          {(graph.evidence ?? result.graphRagEntities ?? []).length === 0 ? (
            <p className="panel__empty">No GraphRAG entities returned for this run.</p>
          ) : (
            (graph.evidence ?? result.graphRagEntities ?? []).map((entity) => (
              <article key={entity.id || entity._id} className="retrieval-card">
                <div className="retrieval-card__top">
                  <strong>{entity.id || entity._id}</strong>
                  <span>{entity.type}</span>
                </div>
                <p>{entity.description || entity.attributes?.description?.[0] || "Connected entity from metadata knowledge graph."}</p>
                <small>
                  Relationships:{" "}
                  {(entity.relationships?.target_ids ?? []).slice(0, 4).join(", ") || "see graph evidence"}
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
            <strong>{result.debug?.timings?.vectorSearchMs ?? result.debug?.vectorSearchMs ?? 0} ms</strong>
          </div>
          <div>
            <span>GraphRAG / $graphLookup</span>
            <strong>{result.debug?.timings?.graphTraversalMs ?? result.debug?.graphTraversalMs ?? 0} ms</strong>
          </div>
          <div>
            <span>Graph entities</span>
            <strong>{result.graphRagEntities?.length ?? graph.evidence?.length ?? 0}</strong>
          </div>
          <div>
            <span>Generation</span>
            <strong>{result.debug?.timings?.generationMs ?? result.debug?.generationMs ?? 0} ms</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{result.debug?.timings?.totalMs ?? result.debug?.totalMs ?? 0} ms</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
