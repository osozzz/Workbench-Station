import { ArrowRight, Check, Folder, FolderPlus, HardDrives, MagnifyingGlass, Prohibit, ShieldCheck, WarningCircle, X } from "@phosphor-icons/react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ageInHours, describeAge, inApp, sourceNames, type Action, type ActionResult, type LogAction, type RunLog, type Snapshot } from "../data";
import { groupBySource, versionsOf } from "../actions";
import { useFolders } from "../folders";

export interface Run {
  total: number;
  log: RunLog | null;
}

function tickState(entry: LogAction | undefined) {
  if (!entry) return undefined;
  if (entry.result === "succeeded") return "done";
  if (entry.result === "failed") return "failed";
  if (entry.startedAt && !entry.finishedAt) return "running";
  return undefined;
}

function Strip({ actions, log }: { actions: Action[]; log: RunLog | null }) {
  const [focused, setFocused] = useState<Action | null>(null);
  const entries = new Map(log?.actions.map((entry) => [entry.actionId, entry]));
  return (
    <>
      <div className="strip" onMouseLeave={() => setFocused(null)}>
        {groupBySource(actions).map(([source, items]) => (
          <div className="strip-group" key={source} style={{ "--count": items.length } as CSSProperties}>
            <div className="strip-ticks">
              {items.map((action) => (
                <button
                  key={action.actionId}
                  className="tick"
                  data-risk={action.risk}
                  data-manual={action.command === null}
                  data-state={tickState(entries.get(action.actionId))}
                  aria-label={`${action.title}, ${action.risk} risk`}
                  onMouseEnter={() => setFocused(action)}
                  onFocus={() => setFocused(action)}
                />
              ))}
            </div>
            <div className="strip-label">
              <b>{items.length}</b> <span>{sourceNames[source] ?? source}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="strip-foot">
        <p className="tick-detail" aria-live="polite">
          {focused ? focused.title : "Each mark is one update. Hover over a mark to see which."}
        </p>
        <div className="legend">
          <span><i data-risk="low" />Low risk</span>
          <span><i data-risk="medium" />Medium risk</span>
          <span><i data-risk="high" />High risk</span>
          <span><i data-manual="true" />Needs you</span>
        </div>
      </div>
    </>
  );
}

const resultLabels: Record<ActionResult, string> = { succeeded: "Installed", failed: "Failed", skipped: "Skipped", "not-run": "Waiting" };

function RunRows({ log }: { log: RunLog }) {
  return (
    <section className="pane">
      <ul className="rows">
        {log.actions.map((action) => (
          <li className="row" key={action.actionId}>
            <span className="row-title">{action.title}</span>
            <span className="result" data-result={action.startedAt && !action.finishedAt ? "running" : action.result}>
              {action.startedAt && !action.finishedAt ? "Installing" : resultLabels[action.result]}
            </span>
            {action.reason && action.result !== "succeeded" && <p>{action.reason}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Overview(props: { snapshot: Snapshot; run: Run | null; auditing: boolean; onAudit(): void; onOpenUpdates(): void; onError(message: string | null): void }) {
  const { snapshot, run, auditing, onAudit, onOpenUpdates, onError } = props;
  const { plan, evaluation } = snapshot;
  const auditButton = (primary: boolean) => (
    <button className={primary ? "button button-primary" : "button"} disabled={!inApp || auditing || run !== null} onClick={onAudit}>
      <MagnifyingGlass size={18} aria-hidden="true" />
      {auditing ? "Auditing, this takes a few minutes" : "Audit this PC"}
    </button>
  );
  if (!plan) return <Welcome auditing={auditing} auditButton={auditButton(true)} onError={onError} />;

  const ready = plan.actions.filter((a) => a.command !== null);
  const manual = plan.actions.filter((a) => a.command === null);
  const stale = ageInHours(plan.report.generatedAt) > 24;
  const deviations = evaluation?.findings.filter((f) => f.status === "deviation" && !f.subjectId) ?? [];
  // Skipped actions never start, so "not-run" is what still counts as waiting.
  const waiting = run?.log?.actions.filter((a) => a.result === "not-run").length ?? run?.total ?? 0;
  const current = run?.log?.actions.find((a) => a.startedAt && !a.finishedAt);
  const verifying = run?.log != null && waiting === 0;

  return (
    <>
      <section className="pane hero" data-scanning={auditing || verifying || undefined}>
        <div className="hero-head">
          <div>
            {run ? (
              // Announced as it changes, so a screen reader follows the install without watching it.
              <div aria-live="polite">
                <h1 className="headline">{verifying ? "Checking what was installed" : `Installing ${run.total - waiting + 1} of ${run.total}`}</h1>
                <p className="subline">
                  {verifying
                    ? "Auditing this PC again. This takes a few minutes."
                    : run.log
                      ? `${current ? `${current.title}.` : "Starting the next update."} You can keep working; some apps may close while they update.`
                      : "Waiting for Windows to give permission."}
                </p>
              </div>
            ) : (
              <>
                <h1 className="headline">{ready.length === 0 ? "Everything that can update is up to date" : `${ready.length} updates ready to install`}</h1>
                <p className="subline">
                  {manual.length} more need you. Last audit {describeAge(plan.report.generatedAt)}.
                </p>
              </>
            )}
          </div>
          {!run && (
            <div className="hero-actions">
              {auditButton(stale)}
              {ready.length > 0 && !stale && (
                <button className="button button-primary" onClick={onOpenUpdates}>
                  Review updates
                  <span className="button-island"><ArrowRight size={14} weight="bold" aria-hidden="true" /></span>
                </button>
              )}
            </div>
          )}
        </div>

        {stale && !run && (
          <p className="notice">
            <WarningCircle size={20} aria-hidden="true" />
            <span>This list is more than a day old, so updates are locked until you audit again.</span>
          </p>
        )}

        {run?.log?.preflight?.blockingApps.length ? (
          <p className="notice">
            <WarningCircle size={20} aria-hidden="true" />
            <span>Close these apps, or their updates will fail: {run.log.preflight.blockingApps.map((b) => b.app).join(", ")}.</span>
          </p>
        ) : null}

        <Strip actions={plan.actions} log={run?.log ?? null} />
      </section>

      {run?.log && <RunRows log={run.log} />}

      {!run && (
        <div className="bento">
          <section className="pane">
            <div className="pane-head">
              <h2 className="section-title">Needs you</h2>
              {manual.length > 6 && <button className="link" onClick={onOpenUpdates}>See all {manual.length}</button>}
            </div>
            <ul className="rows">
              {manual.slice(0, 6).map((action) => (
                <li className="row" key={action.actionId}>
                  <span className="row-title">{action.title}</span>
                  {versionsOf(action)}
                </li>
              ))}
            </ul>
            {manual.length === 0 && <p className="empty">Nothing needs you right now.</p>}
          </section>
          <section className="pane">
            <h2 className="section-title">Your standard</h2>
            {evaluation ? (
              <>
                <div className="score">
                  <strong>{evaluation.summary.compliantCount}</strong>
                  <span>rules met, {evaluation.summary.deviationCount} not met</span>
                </div>
                <div className="rule-ticks" aria-hidden="true">
                  {Array.from({ length: evaluation.summary.compliantCount }, (_, i) => <i key={`met-${i}`} data-met="true" />)}
                  {Array.from({ length: evaluation.summary.deviationCount }, (_, i) => <i key={`not-${i}`} />)}
                </div>
                <ul className="rows">
                  {deviations.slice(0, 5).map((finding) => (
                    <li className="row" key={finding.policyKey}>
                      <span className="row-note">{finding.message}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="empty">Audit this PC to compare it with your standard.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/** First run: what the app does and never does, then the three steps to a first install. */
function Welcome({ auditing, auditButton, onError }: { auditing: boolean; auditButton: ReactNode; onError(message: string | null): void }) {
  const { folders, add, remove } = useFolders(onError);
  const chosen = (folders?.length ?? 0) > 0;
  return (
    <section className="pane welcome" data-scanning={auditing || undefined}>
      <div className="welcome-intro">
        <span className="app-mark app-mark-large" aria-hidden="true" />
        <h1 className="headline">Keep this PC up to date</h1>
        <p className="subline">Workbench Station finds what can be updated on this PC, shows how risky each update is, and installs only what you confirm.</p>
        <ul className="promises">
          <li><ShieldCheck size={20} aria-hidden="true" />Nothing is installed until you confirm it.</li>
          <li><Prohibit size={20} aria-hidden="true" />High-risk and manual updates never run from here.</li>
          <li><HardDrives size={20} aria-hidden="true" />Reports stay on this PC.</li>
        </ul>
      </div>
      <ol className="steps">
        <li className="step" data-done={chosen || undefined}>
          <span className="step-mark">{chosen ? <Check size={16} weight="bold" aria-label="Done" /> : "1"}</span>
          <div className="step-body">
            <h2 className="section-title">Choose your project folders</h2>
            <p>Optional. The audit looks for projects and Git repositories only in these folders, never across a whole drive.</p>
            {chosen && (
              <ul className="folder-chips">
                {folders!.map((folder) => (
                  <li key={folder}>
                    <Folder size={14} aria-hidden="true" />
                    <span>{folder}</span>
                    <button className="chip-remove" aria-label={`Remove ${folder}`} data-tip="Remove folder" disabled={auditing} onClick={() => void remove(folder)}>
                      <X size={12} weight="bold" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <button className="button" disabled={!inApp || folders === null || auditing} onClick={() => void add()}>
                <FolderPlus size={18} aria-hidden="true" />
                {chosen ? "Add another folder" : "Add folder"}
              </button>
            </div>
          </div>
        </li>
        <li className="step">
          <span className="step-mark">2</span>
          <div className="step-body">
            <h2 className="section-title">Audit this PC</h2>
            <p>Reads the apps, tools, and settings on this PC and checks online for newer versions. It changes nothing and takes about three minutes.</p>
            <div>{auditButton}</div>
          </div>
        </li>
        <li className="step">
          <span className="step-mark">3</span>
          <div className="step-body">
            <h2 className="section-title">Review and install</h2>
            <p>Pick the updates you want and see the exact command for each one first. Windows asks for permission once, then this PC is audited again to check the result.</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
