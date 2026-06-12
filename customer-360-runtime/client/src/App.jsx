import { useEffect, useState } from "react";
import {
  fetchActions,
  fetchCustomerProfile,
  fetchHealth,
  searchCustomers,
  seedDemo,
  sendChat
} from "./api.js";
import ChatPanel from "./components/ChatPanel.jsx";
import CustomerProfilePanel from "./components/CustomerProfilePanel.jsx";
import CustomerSearchPanel from "./components/CustomerSearchPanel.jsx";
import MongoTerminalPanel from "./components/MongoTerminalPanel.jsx";
import StatsBar from "./components/StatsBar.jsx";

const samplePrompt =
  "Find high churn-risk postpaid customers in HOU, pull Jamie Torres (7135550101), review recent interactions, and recommend a retention plan using care_kb guidance.";

export default function App() {
  const [stats, setStats] = useState({ totalCustomers: 0, highChurnRiskActive: 0, segments: [] });
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("C000000001");
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "intro",
      role: "assistant",
      text: "Search the 1M+ customer collection, open a 360 profile, then ask the agent to aggregate cohorts or recommend retention actions from care_kb."
    }
  ]);
  const [question, setQuestion] = useState(samplePrompt);
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [actions, setActions] = useState([]);
  const [mongoTerminalOpen, setMongoTerminalOpen] = useState(true);

  async function refreshStats() {
    const payload = await fetchHealth();
    setStats(payload.stats ?? {});
  }

  async function refreshCustomers(nextQuery = query, nextSegment = segment) {
    const payload = await searchCustomers({ q: nextQuery, segment: nextSegment, limit: 24 });
    setCustomers(payload.customers ?? []);
  }

  async function refreshProfile(customerId) {
    if (!customerId) {
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    try {
      const payload = await fetchCustomerProfile(customerId);
      setProfile(payload);
    } catch (error) {
      setStatus(error.message);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }

  async function refreshActions() {
    const payload = await fetchActions();
    setActions(payload.actions ?? []);
  }

  useEffect(() => {
    Promise.all([refreshStats(), refreshCustomers(), refreshProfile("C000000001"), refreshActions()]).catch(
      (error) => setStatus(error.message)
    );

    const statsInterval = window.setInterval(() => {
      refreshStats().catch(() => {});
    }, 8000);

    const actionsInterval = window.setInterval(() => {
      refreshActions().catch(() => {});
    }, 2500);

    return () => {
      window.clearInterval(statsInterval);
      window.clearInterval(actionsInterval);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      refreshCustomers(query, segment).catch((error) => setStatus(error.message));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query, segment]);

  useEffect(() => {
    refreshProfile(selectedCustomerId).catch((error) => setStatus(error.message));
  }, [selectedCustomerId]);

  async function handleSend(message = question) {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setStatus("Running MCP + LLM customer 360 flow...");
    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: "user", text: trimmed }]);
    setQuestion("");

    try {
      const response = await sendChat(trimmed, sessionId || undefined);
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: response.answer ?? response.message ?? "No answer returned."
        }
      ]);
      setStatus("Done.");
      await refreshActions();
    } catch (error) {
      setStatus(error.message);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: `Error: ${error.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setStatus("Seeding 1,000,000 customers into Atlas. This can take several minutes...");
    try {
      await seedDemo();
      await Promise.all([refreshStats(), refreshCustomers(), refreshProfile(selectedCustomerId)]);
      setStatus("Seed completed.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className={`customer360-app${mongoTerminalOpen ? "" : " customer360-app--terminal-collapsed"}`}>
      <header className="customer360-app__hero">
        <div>
          <p className="customer360-app__eyebrow">MongoDB Atlas · Customer 360</p>
          <h1>Customer 360 Command Center</h1>
          <p className="customer360-app__lede">
            Search a million-customer collection, inspect unified profiles, and let the agent aggregate cohorts with MCP.
          </p>
        </div>
        <div className="customer360-app__actions">
          <button type="button" className="ghost-button" onClick={handleSeed} disabled={seeding}>
            {seeding ? "Seeding..." : "Seed 1M customers"}
          </button>
          <span className="customer360-app__status">{status}</span>
        </div>
      </header>

      <StatsBar stats={stats} />

      <div className={`customer360-app__layout${mongoTerminalOpen ? "" : " customer360-app__layout--terminal-collapsed"}`}>
        <CustomerSearchPanel
          query={query}
          segment={segment}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onQueryChange={setQuery}
          onSegmentChange={setSegment}
          onSelectCustomer={setSelectedCustomerId}
        />
        <div className="customer360-app__workspace">
          <CustomerProfilePanel profile={profile} loading={profileLoading} />
          <ChatPanel
            messages={messages}
            question={question}
            loading={loading}
            onQuestionChange={setQuestion}
            onSend={(prompt) => handleSend(typeof prompt === "string" ? prompt : question)}
            samplePrompts={[samplePrompt]}
          />
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
