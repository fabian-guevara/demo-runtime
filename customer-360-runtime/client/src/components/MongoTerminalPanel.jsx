import { useState } from "react";
import { formatMongoStatement } from "../utils/mongoFormat.js";

function formatTimestamp(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatResponse(action) {
  if (action.error) {
    return JSON.stringify(action.error, null, 2);
  }

  if (action.response === null || action.response === undefined) {
    return action.nReturned === null || action.nReturned === undefined
      ? "No response captured."
      : `Returned ${action.nReturned} document${action.nReturned === 1 ? "" : "s"}.`;
  }

  return JSON.stringify(action.response, null, 2);
}

export default function MongoTerminalPanel({ actions, open, onToggle }) {
  const [copiedKey, setCopiedKey] = useState(null);

  async function copyText(key, value) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1500);
  }

  if (!open) {
    return (
      <aside className="mongo-terminal mongo-terminal--collapsed">
        <button type="button" className="mongo-terminal__reopen" onClick={onToggle}>
          ▲ MongoDB observability
        </button>
      </aside>
    );
  }

  return (
    <aside className="mongo-terminal">
      <div className="mongo-terminal__header">
        <div>
          <p className="mongo-terminal__eyebrow">Observability</p>
          <h2>MongoDB terminal</h2>
        </div>
        <button type="button" className="mongo-terminal__hide" onClick={onToggle} aria-label="Hide observability panel">
          ▼
        </button>
      </div>

      <div className="mongo-terminal__body">
        {actions.length === 0 ? (
          <p className="mongo-terminal__empty">
            MCP tool calls and MongoDB payloads appear here after you run chat actions.
          </p>
        ) : null}

        {actions.map((action, index) => {
          const requestText = formatMongoStatement(action);
          const responseText = formatResponse(action);
          const requestKey = `${action.timestamp}-${index}-request`;
          const responseKey = `${action.timestamp}-${index}-response`;

          return (
            <article key={requestKey} className="mongo-terminal__entry">
              <div className="mongo-terminal__entry-header">
                <div>
                  <strong>{action.name}</strong>
                  <div className="mongo-terminal__meta">
                    <span>{formatTimestamp(action.timestamp)}</span>
                    <span>{action.toolName}</span>
                    <span>{action.collectionName}</span>
                    <span>{action.durationMs} ms</span>
                    {action.nReturned !== null && action.nReturned !== undefined ? (
                      <span>{action.nReturned} returned</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mongo-terminal__section">
                <div className="mongo-terminal__section-header">
                  <span>Request payload</span>
                  <button type="button" onClick={() => copyText(requestKey, requestText)}>
                    {copiedKey === requestKey ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="mongo-terminal__code">{requestText}</pre>
              </div>

              <div className="mongo-terminal__section">
                <div className="mongo-terminal__section-header">
                  <span>{action.error ? "Error" : "Return values"}</span>
                  <button type="button" onClick={() => copyText(responseKey, responseText)}>
                    {copiedKey === responseKey ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre
                  className={`mongo-terminal__code${action.error ? " mongo-terminal__code--error" : ""}`}
                >
                  {responseText}
                </pre>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
