import { useState } from "react";

function renderArgument(value) {
  return JSON.stringify(value, null, 2);
}

function formatMongoStatement(action) {
  const collectionName = action.collectionName ?? "collection";
  const operation = action.operation ?? "find";
  const query = action.query ?? {};

  if (operation === "aggregate") {
    const pipeline = Array.isArray(query) ? query : query.pipeline ?? [];
    return `db.${collectionName}.aggregate(${renderArgument(pipeline)})`;
  }

  if (operation === "find" || operation === "findOne") {
    const filter = query.filter ?? query;
    const options = query.options;
    if (options) {
      return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(options)})`;
    }

    return `db.${collectionName}.${operation}(${renderArgument(filter)})`;
  }

  if (operation === "search") {
    return `db.${collectionName}.aggregate(${renderArgument([
      {
        $vectorSearch: query
      }
    ])})`;
  }

  if (operation === "updateOne" || operation === "updateMany") {
    const filter = query.filter ?? {};
    const update = query.update ?? {};
    const options = query.options;
    if (options) {
      return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(update)}, ${renderArgument(options)})`;
    }

    return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(update)})`;
  }

  if (operation === "deleteMany") {
    return `db.${collectionName}.deleteMany(${renderArgument(query.filter ?? query)})`;
  }

  if (operation === "deleteOne") {
    return `db.${collectionName}.deleteOne(${renderArgument(query.filter ?? query)})`;
  }

  return `db.${collectionName}.${operation}(${renderArgument(query)})`;
}

export default function WhatDidWeRun({ actions }) {
  const [expandedId, setExpandedId] = useState(null);

  async function copyJson(action) {
    const value = formatMongoStatement(action);
    await navigator.clipboard.writeText(value);
  }

  return (
    <section className="panel panel--terminal">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Explainability</p>
          <h2>What did we run?</h2>
        </div>
      </div>

      <div className="terminal-feed">
        {actions.map((action, index) => (
          <article key={`${action.timestamp}-${index}`} className="terminal-card">
            <div className="terminal-card__row">
              <strong>{action.name}</strong>
              <button type="button" onClick={() => copyJson(action)}>
                Copy query
              </button>
            </div>
            <div className="terminal-card__meta">
              <span>{action.toolName}</span>
              <span>{action.collectionName}</span>
              <span>{action.operation}</span>
              <span>{action.durationMs} ms</span>
            </div>
            <pre className="terminal-card__query">{formatMongoStatement(action)}</pre>
            <button
              type="button"
              className="terminal-card__toggle"
              onClick={() => setExpandedId(expandedId === index ? null : index)}
            >
              {expandedId === index ? "Hide JSON" : "Show JSON"}
            </button>
            {expandedId === index ? <pre>{JSON.stringify(action, null, 2)}</pre> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
