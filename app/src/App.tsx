import { WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { inApp, loadLatestLog, loadSnapshot, refresh, runUpdate, type Snapshot } from "./data";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bar, viewOrder, type View } from "./Bar";
import { GlassFilters } from "./glass";
import { History } from "./views/History";
import { Overview, type Run } from "./views/Overview";
import { Settings } from "./views/Settings";
import { Updates } from "./views/Updates";

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [auditing, setAuditing] = useState(false);
  const [run, setRun] = useState<Run | null>(null);

  const reload = () => loadSnapshot().then(setSnapshot, (reason) => setError(`The reports could not be read: ${reason}`));
  useEffect(() => {
    void reload();
    // The window starts hidden so it never flashes empty; it appears once the app has drawn.
    if (inApp) void getCurrentWindow().show();

    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const target = viewOrder[Number(event.key) - 1];
      if (target) {
        event.preventDefault();
        setView(target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const audit = async () => {
    setAuditing(true);
    setError(null);
    try {
      await refresh();
      await reload();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setAuditing(false);
    }
  };

  const install = async (actionIds: string[]) => {
    const startedAfter = Date.now();
    setError(null);
    setRun({ total: actionIds.length, log: null });
    setView("overview");
    // The log is rewritten as each action starts and ends, so reading it shows live progress.
    const timer = window.setInterval(() => {
      void loadLatestLog().then((log) => {
        if (log && new Date(log.startedAt).getTime() >= startedAfter - 5000) setRun({ total: actionIds.length, log });
      });
    }, 2000);
    try {
      await runUpdate(actionIds);
      const log = await loadLatestLog();
      const entries = log && new Date(log.startedAt).getTime() >= startedAfter - 5000 ? log.actions : [];
      if (entries.some((a) => a.startedAt)) {
        setView("history");
      } else {
        const reason = entries.find((a) => a.reason)?.reason;
        setError(`Nothing was installed. ${reason ?? "Audit this PC and try again."}`);
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      window.clearInterval(timer);
      setRun(null);
      await reload();
    }
  };

  const plan = snapshot?.plan ?? null;
  const ready = plan?.actions.filter((a) => a.command !== null).length ?? 0;

  return (
    <>
      <GlassFilters />
      <div className="scene" aria-hidden="true" />
      <Bar host={plan?.report.host.name ?? "This PC"} view={view} ready={ready} onSelect={setView} />
      <main className="page">
        <div className="page-inner">
          {error && (
            <p className="notice" data-tone="alert" role="alert">
              <WarningCircle size={20} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          {!error && snapshot === null && view !== "settings" && <Skeleton view={view} />}
          <div className="view" key={view}>
            {snapshot && view === "overview" && <Overview snapshot={snapshot} run={run} auditing={auditing} onAudit={audit} onOpenUpdates={() => setView("updates")} onError={setError} />}
            {snapshot && view === "updates" && <Updates snapshot={snapshot} busy={run !== null || auditing} onInstall={install} onOpenOverview={() => setView("overview")} />}
            {snapshot && view === "history" && <History logs={snapshot.logs} onOpenUpdates={() => setView("updates")} />}
            {view === "settings" && <Settings onError={setError} />}
          </div>
        </div>
      </main>
    </>
  );
}

/** The shape of each view while the last audit loads. */
function Skeleton({ view }: { view: View }) {
  const pane = (key: string, lines: number, opening: "title" | "title-block" | "none") => (
    <div className="pane skeleton" key={key}>
      {opening !== "none" && <i className="skeleton-title" />}
      {Array.from({ length: lines }, (_, index) => <i key={index} className={index % 3 === 2 ? "skeleton-short" : undefined} />)}
      {opening === "title-block" && <i className="skeleton-block" />}
    </div>
  );
  const panes = {
    overview: [pane("hero", 1, "title-block"), pane("lists", 4, "none")],
    updates: [pane("list", 6, "title")],
    history: [pane("latest", 2, "title"), pane("earlier", 2, "none")],
    settings: [],
  }[view];
  return (
    <div className="view" role="status" aria-label="Reading the last audit">
      {panes}
    </div>
  );
}
