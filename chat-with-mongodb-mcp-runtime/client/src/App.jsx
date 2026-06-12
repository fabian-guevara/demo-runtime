import { useEffect, useState } from "react";
import {
  fetchActions,
  fetchConfig,
  fetchSimulatorStatus,
  fetchTowerMap,
  injectErrors,
  saveConfig,
  seedDemo,
  sendChat,
  setAllHealthy,
  startSimulator,
  stopSimulator
} from "./api.js";
import ChatPanel from "./components/ChatPanel.jsx";
import ConfigModal from "./components/ConfigModal.jsx";
import MongoTerminalPanel from "./components/MongoTerminalPanel.jsx";
import SimulatorControls from "./components/SimulatorControls.jsx";
import TowerMapPanel from "./components/TowerMapPanel.jsx";
import { resolveAtlasChartsEmbedUrl } from "./utils/atlasChartsEmbed.js";

const samplePrompt =
  "Please access the realtime_network_logs collection, retrieve events from the last 60 seconds, summarize alert conditions with severity 4 or greater, use vector search to find remediation steps, and identify impacted towers.";

export default function App() {
  const [config, setConfig] = useState({ atlasChartsTowerMapEmbedUrl: "", atlasChartsTowerDashboardEmbedUrl: "" });
  const [towers, setTowers] = useState([]);
  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "assistant",
      text: "Start the tower simulator, then run the sample incident flow. MCP MongoDB tools plus LLM reasoning will inspect logs, search manuals, and summarize impacted towers."
    }
  ]);
  const [question, setQuestion] = useState(samplePrompt);
  const [sessionId, setSessionId] = useState("");
  const [simulatorStatus, setSimulatorStatus] = useState({
    running: false,
    documentsPerBatch: 30,
    intervalMs: 5000
  });
  const [status, setStatus] = useState("Ready.");
  const [loading, setLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [busyControls, setBusyControls] = useState(false);
  const [actions, setActions] = useState([]);
  const [mongoTerminalOpen, setMongoTerminalOpen] = useState(true);

  async function refreshActions() {
    const payload = await fetchActions();
    setActions(payload.actions ?? []);
  }

  async function refreshAll() {
    const [configPayload, towerPayload, simulatorPayload] = await Promise.all([
      fetchConfig(),
      fetchTowerMap(),
      fetchSimulatorStatus()
    ]);
    const nextTowers = towerPayload.towers ?? [];
    setConfig(configPayload);
    setTowers(nextTowers);
    setSimulatorStatus(simulatorPayload);
    return { towers: nextTowers, simulator: simulatorPayload };
  }

  useEffect(() => {
    refreshAll().catch((error) => setStatus(error.message));
    refreshActions().catch(() => {});

    const towerInterval = window.setInterval(() => {
      fetchTowerMap()
        .then((payload) => setTowers(payload.towers ?? []))
        .catch(() => {});
    }, 4000);

    const actionsInterval = window.setInterval(() => {
      refreshActions().catch(() => {});
    }, 2500);

    return () => {
      window.clearInterval(towerInterval);
      window.clearInterval(actionsInterval);
    };
  }, []);

  async function handleSend(message = question) {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setStatus("Running MCP + LLM flow...");
    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: "user", text: trimmed }]);
    setQuestion("");

    try {
      const response = await sendChat(trimmed, sessionId || undefined);
      setSessionId(response.sessionId);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: response.answer,
          llmModel: response.llmModel
        }
      ]);
      setStatus(`Completed with ${response.toolCalls?.length ?? 0} tool calls.`);
      await refreshAll();
      await refreshActions();
    } catch (error) {
      setStatus(error.message);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: `Request failed: ${error.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(values) {
    setSavingConfig(true);
    try {
      const payload = await saveConfig(values);
      setConfig(payload.settings);
      setConfigOpen(false);
      setStatus("Atlas Charts config saved.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function runControl(label, work) {
    setBusyControls(true);
    setStatus(`${label}...`);
    try {
      await work();
      const { towers: latestTowers, simulator } = await refreshAll();
      await refreshActions().catch(() => {});
      const badCount = latestTowers.filter((tower) => tower.mapColor === "red" || tower.maxSeverity >= 4).length;
      const runningLabel = simulator.running ? "Simulator running." : "Simulator stopped.";
      setStatus(`${label} done. ${badCount} alerting · ${runningLabel}`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusyControls(false);
    }
  }

  function summarizeTowers(towerList) {
    const alerting = towerList.filter((tower) => tower.mapColor === "red" || tower.maxSeverity >= 4);
    return {
      alerting,
      healthyCount: towerList.length - alerting.length
    };
  }

  const towerSummary = summarizeTowers(towers);

  const chartEmbedUrl = resolveAtlasChartsEmbedUrl(config.atlasChartsTowerMapEmbedUrl);
  const mapEmbedWarning =
    config.atlasChartsTowerMapEmbedUrl && !chartEmbedUrl
      ? "Saved map URL is invalid (must be charts.mongodb.com/embed/..., not localhost). Showing fallback map — fix in Config."
      : "";

  return (
    <div className={`app-shell${mongoTerminalOpen ? "" : " app-shell--terminal-collapsed"}`}>
      <div className="app-shell__content">
      <header className="hero">
        <div>
          <p className="hero__eyebrow">MCP database tools + Atlas Charts</p>
          <h1>Tower Network Monitoring</h1>
          <p>
            Live tower telemetry, MCP database tools, vector/manual search, and an Atlas Charts slot for your geospatial
            bad-tower map.
          </p>
        </div>
        <div className="hero__actions">
          <button type="button" className="button button--ghost" onClick={() => setConfigOpen(true)}>
            Config
          </button>
        </div>
      </header>

      <div className="status-banner">{status}</div>

      <main className="layout-stack">
        <section className="panel map-section">
          <div className="map-section__header">
            <h2>Tower map</h2>
            {chartEmbedUrl ? (
              <span className="badge badge--muted">Atlas Charts</span>
            ) : (
              <span className="badge badge--muted">Fallback map · Config for Atlas Charts</span>
            )}
          </div>
          <div className="map-slot">
            <TowerMapPanel
              towers={towers}
              chartEmbedUrl={chartEmbedUrl}
              embedWarning={mapEmbedWarning}
            />
          </div>
          <div className="tower-status-bar">
            <span>{towerSummary.healthyCount} healthy</span>
            <span className={towerSummary.alerting.length ? "tower-status-bar__alert" : ""}>
              {towerSummary.alerting.length} alerting
            </span>
            {towerSummary.alerting.length ? (
              <span className="tower-status-bar__names">
                {towerSummary.alerting.map((tower) => tower.name).join(" · ")}
              </span>
            ) : (
              <span className="tower-status-bar__names">All towers green in MongoDB</span>
            )}
          </div>
        </section>
        <SimulatorControls
          status={simulatorStatus}
          busy={busyControls}
          onStart={() => runControl("Start stream", () => startSimulator({ injectErrors: true }))}
          onStop={() => runControl("Stop stream", () => stopSimulator())}
          onInject={() => runControl("Inject errors", () => injectErrors())}
          onAllHealthy={() => runControl("All healthy", () => setAllHealthy())}
          onSeed={() => runControl("Seed demo", () => seedDemo())}
        />
        <ChatPanel
          messages={messages}
          question={question}
          onQuestionChange={setQuestion}
          onSend={handleSend}
          loading={loading}
          samplePrompts={[samplePrompt]}
        />
      </main>

      <ConfigModal
        open={configOpen}
        settings={config}
        saving={savingConfig}
        onClose={() => setConfigOpen(false)}
        onSave={handleSaveConfig}
      />
      </div>

      <MongoTerminalPanel
        actions={actions}
        open={mongoTerminalOpen}
        onToggle={() => setMongoTerminalOpen((current) => !current)}
      />
    </div>
  );
}
