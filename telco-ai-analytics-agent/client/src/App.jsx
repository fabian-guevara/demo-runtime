import { useEffect, useState } from "react";
import {
  clearMemories,
  fetchActions,
  fetchMemories,
  resetDemo,
  sendChat,
  seedDemo,
  storeMemory
} from "./api/client.js";
import ChatPanel from "./components/ChatPanel.jsx";
import DemoScenarioButtons from "./components/DemoScenarioButtons.jsx";
import MemoryPanel from "./components/MemoryPanel.jsx";
import MetricsCard from "./components/MetricsCard.jsx";
import MongoTerminalPanel from "./components/MongoTerminalPanel.jsx";
import RetrievedContext from "./components/RetrievedContext.jsx";

const userId = "demo-user";

export default function App() {
  const starterScenario = "Show churn risk for Texas enterprise accounts";
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "assistant",
      text: "Use the first scenario button to load the main Texas enterprise churn story, then compare it to last month and ask for supporting evidence."
    }
  ]);
  const [metrics, setMetrics] = useState(null);
  const [retrievedContext, setRetrievedContext] = useState([]);
  const [actions, setActions] = useState([]);
  const [memories, setMemories] = useState([]);
  const [shortTermMemory, setShortTermMemory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [mongoTerminalOpen, setMongoTerminalOpen] = useState(true);

  async function refreshActions() {
    const payload = await fetchActions();
    setActions(payload.actions ?? []);
  }

  async function refreshMemories() {
    const payload = await fetchMemories(userId);
    setMemories(payload.memories ?? []);
  }

  useEffect(() => {
    refreshActions().catch(() => {});
    refreshMemories().catch(() => {});
    const actionsInterval = window.setInterval(() => refreshActions().catch(() => {}), 2500);
    return () => window.clearInterval(actionsInterval);
  }, []);

  async function handleSend(message) {
    if (message === "Start a new conversation") {
      setConversationId("");
      setShortTermMemory(null);
      setMetrics(null);
      setRetrievedContext([]);
      setStatus("Started a fresh conversation context.");
      return;
    }

    setLoading(true);
    setStatus("");
    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: message
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const response = await sendChat({
        conversationId: conversationId || undefined,
        userId,
        message
      });

      setConversationId(response.conversationId);
      if (response.metrics) {
        setMetrics(response.metrics);
      }
      setRetrievedContext(response.retrievedContext ?? []);
      setShortTermMemory(response.shortTermMemoryUsed);
      setMemories(response.longTermMemoryUsed?.length ? response.longTermMemoryUsed : memories);
      setStatus(
        `Loaded ${response.metrics ? "metrics" : "no metrics"} and ${response.retrievedContext?.length ?? 0} retrieved context item${response.retrievedContext?.length === 1 ? "" : "s"}.`
      );
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: response.answer,
          meta: {
            toolCalls: response.toolCalls,
            shortTermMemoryUsed: response.shortTermMemoryUsed,
            retrievedContextCount: response.retrievedContext?.length ?? 0
          }
        }
      ]);

      await Promise.all([refreshActions(), refreshMemories()]);
    } catch (error) {
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

  async function handleStorePreference() {
    setLoading(true);
    try {
      await storeMemory({
        userId,
        key: "texas-enterprise-risk-preferences",
        memoryText:
          "For Texas enterprise accounts, leadership cares most about billing disputes, NPS drops, and network incidents.",
        metadata: {
          region: "Texas",
          segment: "enterprise",
          memoryType: "preference"
        }
      });
      await Promise.all([refreshMemories(), refreshActions()]);
      setStatus("Stored the default demo preference.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearMemories() {
    setLoading(true);
    try {
      await clearMemories(userId);
      await Promise.all([refreshMemories(), refreshActions()]);
      setStatus("Cleared demo memories.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(type) {
    setLoading(true);
    try {
      if (type === "seed") {
        await seedDemo();
        setStatus("Seeded demo data.");
      } else {
        await resetDemo();
        setStatus("Reset the demo to story state.");
      }

      await Promise.all([refreshActions(), refreshMemories()]);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`app-shell${mongoTerminalOpen ? "" : " app-shell--terminal-collapsed"}`}>
      <div className="app-shell__content">
        <header className="hero">
          <div>
            <p className="hero__eyebrow">MongoDB demo for Telco</p>
            <h1>AI Analytics Agent</h1>
            <p>
              Deterministic telecom analytics over MongoDB operational data, Vector Search context, and short-term plus long-term memory.
            </p>
          </div>
          <div className="hero__actions">
            <button type="button" onClick={() => handleSend(starterScenario)} disabled={loading}>
              Run starter scenario
            </button>
            <button type="button" onClick={() => handleReset("seed")} disabled={loading}>
              Seed data
            </button>
            <button type="button" onClick={() => handleReset("reset")} disabled={loading}>
              Reset story state
            </button>
          </div>
        </header>

        <DemoScenarioButtons onSelect={handleSend} />
        {status ? <div className="status-banner">{status}</div> : null}

        <div className="main-grid">
          <div className="main-grid__left">
            <ChatPanel messages={messages} onSend={handleSend} loading={loading} />
            <MetricsCard metrics={metrics} loading={loading} />
            <RetrievedContext context={retrievedContext} />
            <MemoryPanel
              conversationId={conversationId}
              shortTermMemory={shortTermMemory}
              longTermMemories={memories}
              onStorePreference={handleStorePreference}
              onClearMemories={handleClearMemories}
              onRefreshMemories={refreshMemories}
            />
          </div>
        </div>
      </div>

      <MongoTerminalPanel
        actions={actions}
        open={mongoTerminalOpen}
        onToggle={() => setMongoTerminalOpen((current) => !current)}
      />
    </div>
  );
}
