import { useState } from "react";
import ActionButton from "./ActionButton.jsx";
import { getDemoMongoStack } from "../data/demoMongoStack.js";

function renderMissingEnv(missingEnv) {
  if (!missingEnv.length) {
    return <p className="demo-card__support">Ready to run.</p>;
  }

  return (
    <p className="demo-card__support">
      Missing credentials: {missingEnv.join(", ")}. Click Run to configure them.
    </p>
  );
}

export default function DemoCard({
  demo,
  pendingAction,
  onDemoAction,
  onOpenArchitecture
}) {
  const [expanded, setExpanded] = useState(false);
  const mongoStack = getDemoMongoStack(demo);

  return (
    <article className={`demo-card demo-card--list${expanded ? " demo-card--expanded" : ""}`}>
      <button
        type="button"
        className="demo-card__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="demo-card__toggle-main">
          <div className="demo-card__header">
            <div>
              <p className="demo-card__eyebrow">{demo.eyebrow || "Atlas demo"}</p>
              <h2>{demo.name}</h2>
              {mongoStack ? (
                <p className="demo-card__mongo-stack">{mongoStack}</p>
              ) : null}
            </div>
            <span className={`status-pill status-pill--${demo.status.toLowerCase().replace(/\s+/g, "-")}`}>
              {demo.status}
            </span>
          </div>

          <p className="demo-card__description">{demo.description}</p>

          <div className="demo-card__meta">
            <span>Cluster: {demo.clusterName || "Not set"}</span>
            <span>Repo: {demo.repoExists ? "Connected" : "Missing locally"}</span>
          </div>

          {renderMissingEnv(demo.missingEnv)}

          {demo.lastError ? <p className="demo-card__error">Last error: {demo.lastError}</p> : null}
        </div>

        <span className="demo-card__toggle-icon" aria-hidden="true">
          ▾
        </span>
      </button>

      <div className="demo-card__actions demo-card__actions--compact">
        <ActionButton
          tone="accent"
          onClick={() => onDemoAction(demo, "start")}
          busy={pendingAction === "start"}
        >
          Run
        </ActionButton>
        <ActionButton onClick={() => onDemoAction(demo, "seed")} busy={pendingAction === "seed"}>
          Seed
        </ActionButton>
        <ActionButton
          tone="danger"
          onClick={() => onDemoAction(demo, "stop")}
          busy={pendingAction === "stop"}
        >
          Stop
        </ActionButton>
        <ActionButton onClick={() => onOpenArchitecture(demo)}>Architecture</ActionButton>
      </div>
    </article>
  );
}
