import { useEffect, useState } from "react";
import { fetchDemoActions, fetchQueryRuns, fetchSchema, runQuery, seedDemo } from "./api.js";
import MongoTerminalPanel from "./components/MongoTerminalPanel.jsx";
import QueryPlanView from "./components/QueryPlanView.jsx";
import QueryRunsPanel from "./components/QueryRunsPanel.jsx";
import RetrievedPanel from "./components/RetrievedPanel.jsx";
import SampleQuestions from "./components/SampleQuestions.jsx";
import SqlTerminal from "./components/SqlTerminal.jsx";

const defaultQuestion =
  "How many high-value customers had billing issues after a plan migration in the last 30 days?";

function formatUiError(prefix, error) {
  const source = error.source ? `${error.source}` : "application";
  const operation = error.operation ? `${error.operation}` : "unknown-operation";
  const target = error.details?.target ? ` Target: ${error.details.target}.` : "";
  const hint = error.hint ? ` ${error.hint}` : "";
  const requestId = error.requestId ? ` Request ID: ${error.requestId}.` : "";
  return `${prefix}: [${source}] ${operation}. ${error.message}.${target}${hint}${requestId}`;
}

export default function App() {
  const [question, setQuestion] = useState(defaultQuestion);
  const [result, setResult] = useState(null);
  const [runs, setRuns] = useState([]);
  const [schemaStats, setSchemaStats] = useState(null);
  const [status, setStatus] = useState("Ready to discover metadata, relationships, and a query plan.");
  const [loading, setLoading] = useState(false);
  const [mongoActions, setMongoActions] = useState([]);
  const [mongoTerminalOpen, setMongoTerminalOpen] = useState(true);

  async function refreshMongoActions() {
    const payload = await fetchDemoActions();
    setMongoActions(payload.actions ?? []);
  }

  async function refreshOverview() {
    const [schemaPayload, runsPayload] = await Promise.all([fetchSchema(), fetchQueryRuns()]);
    setSchemaStats({
      tableCount: schemaPayload.tables?.length ?? 0,
      edgeCount: schemaPayload.edges?.length ?? 0
    });
    setRuns(runsPayload.runs ?? []);
  }

  useEffect(() => {
    refreshOverview().catch((error) => {
      setStatus(formatUiError("Failed to load overview", error));
    });
    refreshMongoActions().catch(() => {});
    const actionsInterval = window.setInterval(() => refreshMongoActions().catch(() => {}), 2500);
    return () => window.clearInterval(actionsInterval);
  }, []);

  async function handleRun(customQuestion = question) {
    setLoading(true);
    setStatus("Running metadata retrieval and query planning...");

    try {
      const payload = await runQuery(customQuestion);
      setQuestion(customQuestion);
      setResult(payload);
      setStatus(
        `Retrieval ${payload.retrieval?.mode ?? payload.debug?.retrievalMode ?? "unknown"} · plan ${
          payload.plan?.isValid ? "valid" : "invalid"
        } · ${payload.debug?.timings?.totalMs ?? payload.debug?.totalMs ?? 0} ms`
      );
      await refreshOverview();
      await refreshMongoActions();
    } catch (error) {
      setStatus(formatUiError("Request failed", error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setLoading(true);
    setStatus("Seeding metadata catalog...");

    try {
      await seedDemo();
      await refreshOverview();
      await refreshMongoActions();
      setStatus("Seed completed. The metadata catalog is ready.");
    } catch (error) {
      setStatus(formatUiError("Seed failed", error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`app-shell${mongoTerminalOpen ? "" : " app-shell--terminal-collapsed"}`}>
      <div className="app-shell__content">
        <header className="hero">
          <div>
            <p className="hero__eyebrow">MongoDB for agentic query planning</p>
            <h1>Agentic Metadata Planner</h1>
            <p>
              A MongoDB-powered retrieval layer for discovering warehouse metadata, relationship edges, join paths, and query plans for AI data agents.
            </p>
          </div>
          <div className="hero__stats">
            <span>{schemaStats?.tableCount ?? 0} table nodes</span>
            <span>{schemaStats?.edgeCount ?? 0} relationship edges</span>
            <span>{runs.length} saved runs</span>
          </div>
        </header>

        <div className="status-banner">{status}</div>

        <main className="content-grid">
          <section className="left-rail">
            <article className="panel panel--input">
              <p className="panel__eyebrow">Ask the agent</p>
              <h2>Natural-language question</h2>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about churn, billing issues, table selection, or join paths."
              />
              <div className="button-row">
                <button type="button" className="primary-button" onClick={() => handleRun()} disabled={loading}>
                  {loading ? "Running..." : "Run Agent"}
                </button>
                <button type="button" className="ghost-button" onClick={handleSeed} disabled={loading}>
                  Seed Catalog
                </button>
              </div>
            </article>

            <article className="panel">
              <p className="panel__eyebrow">Sample prompts</p>
              <h2>Demo-ready questions</h2>
              <SampleQuestions
                onSelect={(sample) => {
                  setQuestion(sample);
                  handleRun(sample);
                }}
              />
            </article>

            <QueryRunsPanel runs={runs} />
          </section>

          <section className="main-rail">
            <QueryPlanView result={result} />
          </section>

          <section className="right-rail">
            <RetrievedPanel result={result} />
            <SqlTerminal
              sql={
                result?.sql?.text ||
                (result?.sql?.status === "validation_failed"
                  ? `-- SQL not generated: ${(result.sql.warnings ?? []).join(" ")}`
                  : "-- Run a question to generate SQL")
              }
            />
          </section>
        </main>
      </div>

      <MongoTerminalPanel
        actions={mongoActions}
        open={mongoTerminalOpen}
        onToggle={() => setMongoTerminalOpen((current) => !current)}
      />
    </div>
  );
}
