import { CaretRight, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Command } from "./actions";
import { describeFailure, inApp, loadLatestLog, loadSnapshot, refresh, runUpdate, type AppError, type RunLog, type Snapshot } from "./data";
import { getCurrentWindow, ProgressBarStatus, UserAttentionType } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Bar, viewOrder, type View } from "./Bar";
import { GlassFilters } from "./glass";
import { History } from "./views/History";
import { Overview, type Run } from "./views/Overview";
import { Settings } from "./views/Settings";
import { Updates } from "./views/Updates";

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [view, setView] = useState<View>("overview");
  const [auditing, setAuditing] = useState(false);
  const [run, setRun] = useState<Run | null>(null);

  const reload = () =>
    loadSnapshot().then(setSnapshot, (reason) =>
      setError(describeFailure(reason, "The last audit's reports could not be read. Audit this PC again to rebuild them.")),
    );
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
      setError(describeFailure(reason));
    } finally {
      setAuditing(false);
    }
  };

  const install = async (actionIds: string[]) => {
    const startedAfter = Date.now();
    const total = actionIds.length;
    const appWindow = inApp ? getCurrentWindow() : null;
    setError(null);
    setRun({ total, log: null });
    setView("overview");
    // Until Windows gives permission, the taskbar button only shows that something is happening.
    void appWindow?.setProgressBar({ status: ProgressBarStatus.Indeterminate });
    // The log is rewritten as each action starts and ends, so reading it shows live progress.
    const timer = window.setInterval(() => {
      void loadLatestLog().then((log) => {
        if (!log || new Date(log.startedAt).getTime() < startedAfter - 5000) return;
        setRun({ total, log });
        const finished = log.actions.filter((a) => a.result !== "not-run").length;
        const failing = log.actions.some((a) => a.result === "failed");
        void appWindow?.setProgressBar({
          status: failing ? ProgressBarStatus.Error : ProgressBarStatus.Normal,
          progress: Math.round((100 * finished) / total),
        });
      });
    }, 2000);
    try {
      await runUpdate(actionIds);
      const log = await loadLatestLog();
      const entries = log && new Date(log.startedAt).getTime() >= startedAfter - 5000 ? log.actions : [];
      if (log && entries.some((a) => a.startedAt)) {
        setView("history");
        void tellWhenAway(log);
      } else {
        const reason = entries.find((a) => a.reason)?.reason;
        setError({ message: `Nothing was installed. ${reason ?? "Audit this PC and try again."}` });
      }
    } catch (reason) {
      setError(describeFailure(reason));
    } finally {
      window.clearInterval(timer);
      void appWindow?.setProgressBar({ status: ProgressBarStatus.None });
      setRun(null);
      await reload();
    }
  };

  // Closing the window doesn't stop an install, so it asks first.
  const closing = useRef<HTMLDialogElement>(null);
  const installing = run !== null;
  useEffect(() => {
    if (!inApp || !installing) return;
    const listening = getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      closing.current?.showModal();
      // The safe choice starts focused, so Enter keeps the window open.
      closing.current?.querySelector<HTMLButtonElement>(".button-primary")?.focus();
    });
    return () => void listening.then((stop) => stop());
  }, [installing]);

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
            <div className="notice" data-tone="alert" role="alert">
              <WarningCircle size={20} aria-hidden="true" />
              <div className="notice-body">
                <p>{error.message}</p>
                {error.detail && (
                  <details>
                    <summary>
                      <CaretRight size={14} weight="bold" aria-hidden="true" />
                      Details
                    </summary>
                    <Command text={error.detail} label="Copy details" />
                  </details>
                )}
              </div>
            </div>
          )}
          {!error && snapshot === null && view !== "settings" && <Skeleton view={view} />}
          <div className="view" key={view}>
            {snapshot && view === "overview" && <Overview snapshot={snapshot} run={run} auditing={auditing} onAudit={audit} onOpenUpdates={() => setView("updates")} onError={(message) => setError(message === null ? null : { message })} />}
            {snapshot && view === "updates" && <Updates snapshot={snapshot} busy={run !== null || auditing} onInstall={install} onOpenOverview={() => setView("overview")} />}
            {snapshot && view === "history" && <History logs={snapshot.logs} onOpenUpdates={() => setView("updates")} />}
            {view === "settings" && <Settings onError={(message) => setError(message === null ? null : { message })} />}
          </div>
        </div>
      </main>
      <dialog className="sheet close-guard" ref={closing} aria-labelledby="close-title">
        <h2 className="sheet-title" id="close-title">The install keeps running if you close Workbench Station</h2>
        <p>Updates that already started finish on their own. Open the app again later and History shows how each one went.</p>
        <div className="close-guard-actions">
          <button className="button" onClick={() => void getCurrentWindow().destroy()}>Close anyway</button>
          <button className="button button-primary" onClick={() => closing.current?.close()}>Keep open</button>
        </div>
      </dialog>
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

/** When an install ends while the window is in the background, the taskbar button flashes and Windows says how it went. */
async function tellWhenAway(log: RunLog) {
  if (!inApp || document.hasFocus()) return;
  const installed = log.actions.filter((a) => a.result === "succeeded").length;
  const failed = log.actions.filter((a) => a.result === "failed").length;
  void getCurrentWindow().requestUserAttention(UserAttentionType.Informational);
  let allowed = await isPermissionGranted();
  if (!allowed) allowed = (await requestPermission()) === "granted";
  if (!allowed) return;
  sendNotification({
    title: failed === 0 ? "Updates installed" : "Some updates didn't install",
    body: `${installed} installed${failed ? `, ${failed} failed` : ""}. Open Workbench Station to see the details in History.`,
  });
}
