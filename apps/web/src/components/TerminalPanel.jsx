import { useMemo, useState } from "react";
import ActionButton from "./ActionButton.jsx";

function formatTimestamp(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function entryQuery(entry) {
  return (
    entry.data?.query ??
    entry.data?.atlasSearchStage ??
    entry.data?.vectorSearchStage ??
    null
  );
}

function renderArgument(value) {
  return JSON.stringify(value, null, 2);
}

function formatMongoStatement(entry) {
  const data = entry.data ?? {};
  const collectionName = data.collectionName ?? "collection";
  const operation = data.operation ?? "find";
  const query = entryQuery(entry) ?? {};

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

  if (operation === "updateOne" || operation === "updateMany") {
    const filter = query.filter ?? {};
    const update = query.update ?? {};
    const options = query.options;
    if (options) {
      return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(update)}, ${renderArgument(options)})`;
    }

    return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(update)})`;
  }

  if (operation === "deleteOne" || operation === "deleteMany") {
    const filter = query.filter ?? query;
    return `db.${collectionName}.${operation}(${renderArgument(filter)})`;
  }

  if (operation === "insertOne") {
    const document = query.document ?? query;
    return `db.${collectionName}.insertOne(${renderArgument(document)})`;
  }

  if (operation === "search") {
    return `db.${collectionName}.aggregate(${renderArgument([
      {
        $vectorSearch: query
      }
    ])})`;
  }

  return `db.${collectionName}.${operation}(${renderArgument(query)})`;
}

function JsonBlock({ title, value }) {
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return null;
  }

  return (
    <div className="json-block">
      <button
        type="button"
        className="json-block__toggle"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Hide" : "Show"} {title}
      </button>
      {expanded ? <pre>{JSON.stringify(value, null, 2)}</pre> : null}
    </div>
  );
}

function ActionSummary({ entry }) {
  const data = entry.data ?? {};

  if (entry.type !== "demo-action") {
    return <JsonBlock title="payload" value={data} />;
  }

  return (
    <div className="terminal-entry__details">
      <div className="terminal-detail-grid">
        <span>Tool</span>
        <strong>{data.toolName ?? "None"}</strong>
        <span>MongoDB op</span>
        <strong>{data.operation ?? "Unknown"}</strong>
        <span>Database</span>
        <strong>{data.dbName ?? "Unknown"}</strong>
        <span>Collection</span>
        <strong>{data.collectionName ?? "Unknown"}</strong>
        <span>Duration</span>
        <strong>{data.durationMs ?? "n/a"} ms</strong>
        <span>Returned</span>
        <strong>{data.nReturned ?? "n/a"}</strong>
        <span>LLM model</span>
        <strong>{data.llmModel ?? "n/a"}</strong>
        <span>Embedding model</span>
        <strong>{data.embeddingModel ?? "n/a"}</strong>
        <span>Token estimate</span>
        <strong>{data.tokenEstimate ?? "n/a"}</strong>
      </div>

      {entryQuery(entry) ? (
        <div className="json-block">
          <span className="json-block__label">MongoDB statement</span>
          <pre className="terminal-entry__query">{formatMongoStatement(entry)}</pre>
        </div>
      ) : null}
      <JsonBlock title="raw query payload" value={entryQuery(entry)} />
      <JsonBlock title="explain summary" value={data.explainSummary} />
      <JsonBlock
        title="short-term memory context"
        value={{
          conversationId: data.conversationId ?? null,
          checkpointCollection: data.checkpointCollection ?? null,
          lastCheckpointTimestamp: data.lastCheckpointTimestamp ?? null,
          followUpContext: data.followUpContext ?? null
        }}
      />
    </div>
  );
}

export default function TerminalPanel({
  entries,
  pinnedLatestAction,
  onTogglePinnedLatest,
  onClear,
  open = true,
  onToggle
}) {
  const [copiedId, setCopiedId] = useState(null);

  const latestAction = useMemo(
    () => entries.find((entry) => entry.type === "demo-action") ?? null,
    [entries]
  );

  const visibleEntries = pinnedLatestAction && latestAction ? [latestAction] : entries;

  async function copyQuery(entry) {
    const value = entryQuery(entry);
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(formatMongoStatement(entry));
    setCopiedId(entry.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  if (!open) {
    return (
      <div className="terminal-panel terminal-panel--collapsed">
        <button
          type="button"
          className="terminal-panel__toggle"
          onClick={onToggle}
          aria-label="Show observability panel"
          title="Show panel"
        >
          ▲
        </button>
      </div>
    );
  }

  return (
    <section className="terminal-panel">
      <div className="terminal-panel__header">
        <div className="terminal-panel__title-row">
          <div>
            <p className="terminal-panel__eyebrow">Observability</p>
            <h2>Runtime terminal</h2>
          </div>
          <button
            type="button"
            className="terminal-panel__toggle"
            onClick={onToggle}
            aria-label="Hide observability panel"
            title="Hide panel"
          >
            ▼
          </button>
        </div>
        <div className="terminal-panel__actions">
          <ActionButton onClick={onTogglePinnedLatest}>
            {pinnedLatestAction ? "Show all logs" : "Pin latest action"}
          </ActionButton>
          <ActionButton tone="danger" onClick={onClear}>
            Clear logs
          </ActionButton>
        </div>
      </div>

      <div className="terminal-panel__body">
        {visibleEntries.length === 0 ? (
          <p className="terminal-panel__empty">
            Runtime logs, cluster output, and tracked MongoDB actions will stream here.
          </p>
        ) : null}

        {visibleEntries.map((entry) => (
          <article key={entry.id} className={`terminal-entry terminal-entry--${entry.level}`}>
            <div className="terminal-entry__header">
              <div>
                <span className="terminal-entry__time">{formatTimestamp(entry.timestamp)}</span>
                <span className="terminal-entry__type">{entry.type}</span>
                {entry.demoId ? <span className="terminal-entry__demo">{entry.demoId}</span> : null}
              </div>
              {entryQuery(entry) ? (
                <button
                  className="terminal-entry__copy"
                  type="button"
                  onClick={() => copyQuery(entry)}
                >
                  {copiedId === entry.id ? "Copied" : "Copy query"}
                </button>
              ) : null}
            </div>
            <p className="terminal-entry__message">{entry.message}</p>
            <ActionSummary entry={entry} />
          </article>
        ))}
      </div>
    </section>
  );
}
