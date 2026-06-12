import { useEffect, useMemo, useState } from "react";
import {
  clearTelemetry,
  fetchDemos,
  fetchTelemetry,
  runDemoAction,
  storeCredentials
} from "../api/client.js";
import DemoCard from "../components/DemoCard.jsx";
import CredentialModal from "../components/CredentialModal.jsx";
import Layout from "../components/Layout.jsx";
import TerminalPanel from "../components/TerminalPanel.jsx";
import ActionButton from "../components/ActionButton.jsx";

const inferredApiBaseUrl =
  typeof window === "undefined"
    ? "http://127.0.0.1:4000/api"
    : `${window.location.protocol}//${window.location.hostname}:4000/api`;

const apiBaseUrl = import.meta.env.VITE_API_URL ?? inferredApiBaseUrl;

const SHARED_CREDENTIAL_KEYS = [
  "MONGODB_URI",
  "GROVE_API_KEY",
  "GROVE_MODEL",
  "GROVE_API_URL"
];

export default function Dashboard() {
  const [demos, setDemos] = useState([]);
  const [entries, setEntries] = useState([]);
  const [pending, setPending] = useState({});
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [pinnedLatestAction, setPinnedLatestAction] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [pageError, setPageError] = useState("");

  const refreshDemos = async () => {
    try {
      const payload = await fetchDemos();
      setDemos(payload.demos ?? []);
      setPageError("");
    } catch (error) {
      setPageError(error.message);
    }
  };

  const refreshTelemetry = async () => {
    try {
      const payload = await fetchTelemetry();
      setEntries(payload.entries ?? []);
    } catch (error) {
      setPageError(error.message);
    }
  };

  useEffect(() => {
    refreshDemos();
    const interval = window.setInterval(refreshDemos, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshTelemetry();
    const interval = window.setInterval(refreshTelemetry, 2000);
    return () => window.clearInterval(interval);
  }, []);

  const demoCards = useMemo(
    () =>
      demos.map((demo) => (
        <DemoCard
          key={demo.id}
          demo={demo}
          pendingAction={pending[demo.id] ?? ""}
          onDemoAction={handleDemoAction}
          onOpenArchitecture={handleOpenArchitecture}
        />
      )),
    [demos, pending]
  );

  async function withPending(demoId, action, work, onError) {
    setPending((current) => ({
      ...current,
      [demoId]: action
    }));

    try {
      await work();
      await Promise.all([refreshDemos(), refreshTelemetry()]);
      setPageError("");
    } catch (error) {
      setPageError(error.message);
      onError?.(error);
      await refreshTelemetry();
    } finally {
      setPending((current) => ({
        ...current,
        [demoId]: ""
      }));
    }
  }

  function openCredentialModal(demo, error) {
    setSelectedDemo({
      ...demo,
      forceCredentialKeys: error?.credentialKeys?.length
        ? error.credentialKeys
        : SHARED_CREDENTIAL_KEYS.filter((key) => demo.requiredEnv.includes(key)),
      configuredValues: {
        ...(demo.configuredValues ?? {}),
        ...Object.fromEntries(
          SHARED_CREDENTIAL_KEYS.filter((key) => demo.requiredEnv.includes(key)).map((key) => [
            key,
            demo.configuredValues?.[key] ?? ""
          ])
        )
      },
      resumeAction: "start",
      preflightError: error?.message ?? ""
    });
  }

  async function handleDemoAction(demo, action) {
    await withPending(
      demo.id,
      action,
      async () => {
        if (action === "start") {
          await runDemoAction(demo.id, "setup").catch(() => {});
        }

        await runDemoAction(demo.id, action);

        if (action === "start" && demo.appUrl) {
          window.open(demo.appUrl, "_blank", "noopener,noreferrer");
        }
      },
      (error) => {
        if (
          action === "start" &&
          (error.code === "DEMO_PREFLIGHT_FAILED" || error.code === "DEMO_CONFIG_MISSING")
        ) {
          openCredentialModal(demo, error);
        }
      }
    );
  }

  function handleOpenArchitecture(demo) {
    window.open(`${apiBaseUrl}/demos/${demo.id}/architecture`, "_blank", "noopener,noreferrer");
  }

  function handleOpenSharedCredentials() {
    const templateDemo =
      demos.find((demo) => demo.requiredEnv.includes("GROVE_API_KEY")) ?? demos[0];

    if (!templateDemo) {
      return;
    }

    setSelectedDemo({
      ...templateDemo,
      name: "Shared demo credentials",
      forceCredentialKeys: SHARED_CREDENTIAL_KEYS,
      configuredValues: Object.fromEntries(
        SHARED_CREDENTIAL_KEYS.map((key) => [key, templateDemo.configuredValues?.[key] ?? ""])
      ),
      resumeAction: null,
      preflightError: ""
    });
  }

  async function handleSaveCredentials(values) {
    setSavingCredentials(true);

    try {
      await storeCredentials(values);
      const pendingDemo = selectedDemo;
      setSelectedDemo(null);
      await Promise.all([refreshDemos(), refreshTelemetry()]);
      setPageError("");

      if (pendingDemo?.resumeAction) {
        await withPending(
          pendingDemo.id,
          pendingDemo.resumeAction,
          async () => {
            await runDemoAction(pendingDemo.id, "setup").catch(() => {});
            await runDemoAction(pendingDemo.id, pendingDemo.resumeAction);

            if (pendingDemo.appUrl) {
              window.open(pendingDemo.appUrl, "_blank", "noopener,noreferrer");
            }
          },
          (error) => {
            if (
              error.code === "DEMO_PREFLIGHT_FAILED" ||
              error.code === "DEMO_CONFIG_MISSING"
            ) {
              openCredentialModal(pendingDemo, error);
            }
          }
        );
      }
    } catch (error) {
      setPageError(error.message);
    } finally {
      setSavingCredentials(false);
    }
  }

  async function handleClearTelemetry() {
    try {
      await clearTelemetry();
      await refreshTelemetry();
      setPinnedLatestAction(false);
      setPageError("");
    } catch (error) {
      setPageError(error.message);
    }
  }

  return (
    <>
      <Layout
        sidebarCollapsed={!terminalOpen}
        main={
          <div className="dashboard">
            <header className="dashboard__hero">
              <div>
                <p className="dashboard__eyebrow">MongoDB Atlas · Telco demos</p>
                <h1>Demo runtime</h1>
                <p className="dashboard__lede">Run, seed, and stop demos.</p>
              </div>
              <div className="dashboard__summary">
                <span>{demos.length} demos</span>
                <span>{demos.filter((demo) => demo.status === "Running").length} running</span>
                <ActionButton onClick={handleOpenSharedCredentials}>Credentials</ActionButton>
              </div>
            </header>

            {pageError ? <div className="dashboard__error">{pageError}</div> : null}

            <section className="dashboard__list">{demoCards}</section>
          </div>
        }
        sidebar={
          <TerminalPanel
            entries={entries}
            pinnedLatestAction={pinnedLatestAction}
            onTogglePinnedLatest={() => setPinnedLatestAction((current) => !current)}
            onClear={handleClearTelemetry}
            open={terminalOpen}
            onToggle={() => setTerminalOpen((current) => !current)}
          />
        }
      />

      <CredentialModal
        demo={selectedDemo}
        open={Boolean(selectedDemo)}
        onClose={() => setSelectedDemo(null)}
        onSave={handleSaveCredentials}
        saving={savingCredentials}
      />
    </>
  );
}
