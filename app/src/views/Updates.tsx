import { ArrowCounterClockwise, ArrowSquareOut, BookOpenText, Clock, PushPin, Sparkle, SquaresFour, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { ageInHours, describeFailure, inApp, localDate, openLink, releaseNotes, sourceName, type Action, type Hold, type Risk, type Snapshot } from "../data";
import { guideForAction, type GuideId } from "../guides";
import { Command, groupBySource, riskLabel, versionsOf } from "../actions";
import { formatDate, t, tn } from "../i18n";

type Filter = "ready" | "manual" | Risk | "held";

type Notes = { state: "idle" } | { state: "loading" } | { state: "done"; notes: string | null; url: string | null } | { state: "failed"; reason: string };

/** Looked up only when asked, so opening an update never reaches the network on its own. */
function ReleaseNotes({ pkg, version }: { pkg: string; version: string }) {
  const [notes, setNotes] = useState<Notes>({ state: "idle" });
  const load = () => {
    setNotes({ state: "loading" });
    releaseNotes(pkg, version).then(
      (found) => setNotes({ state: "done", ...found }),
      (reason) => setNotes({ state: "failed", reason: describeFailure(reason, t("The WinGet catalog couldn't be reached, so what changes isn't known. Try again later.")).message }),
    );
  };

  if (notes.state === "idle" || notes.state === "loading") {
    return (
      <button className="link" disabled={!inApp || notes.state === "loading"} onClick={load}>
        <Sparkle size={16} aria-hidden="true" />
        {notes.state === "loading" ? t("Looking up what changes…") : t("What changes in {version}", { version })}
      </button>
    );
  }
  if (notes.state === "failed") return <p className="detail-note" role="status">{notes.reason}</p>;
  return (
    <div className="release-notes" role="status">
      {notes.notes && <p className="release-notes-text">{notes.notes}</p>}
      {notes.url && (
        <button className="link" onClick={() => openLink(notes.url!)}>
          <ArrowSquareOut size={16} aria-hidden="true" />
          {t("Release notes on {site}", { site: new URL(notes.url).hostname })}
        </button>
      )}
      {!notes.notes && !notes.url && <p className="detail-note">{t("The WinGet catalog has no notes for {version}.", { version })}</p>}
    </div>
  );
}

/** "Monday, November 18" for a yyyy-MM-dd date, read as a local day. */
const describeDay = (day: string) => formatDate(new Date(`${day}T00:00`), { weekday: "long", month: "long", day: "numeric" });

function ActionDetail(props: { action: Action; locked: boolean; onHold(until: string | null): void; onOpenGuide(id: GuideId): void }) {
  const { action, locked, onHold, onOpenGuide } = props;
  const guide = guideForAction(action);
  const blocked = action.command !== null && action.risk === "high";
  return (
    <>
      <p className="detail-facts">
        <span data-risk={action.risk}>{riskLabel(action.risk)}</span>
        <span>{action.reversible ? t("Can be undone") : t("Cannot be undone")}</span>
        <span>{sourceName(action.source.type)}</span>
      </p>
      <p>{action.message}</p>
      {action.command ? <Command text={action.command} /> : <p className="detail-note">{t("This one has no command. You do it yourself.")}</p>}
      {blocked && <p className="detail-note">{t("High-risk updates do not run from here.")}</p>}
      {action.source.type === "winget" && action.subjectId?.startsWith("winget:") && action.targetVersion && (
        <ReleaseNotes key={action.actionId} pkg={action.subjectId.slice("winget:".length)} version={action.targetVersion} />
      )}
      {guide && (
        <button className="link" onClick={() => onOpenGuide(guide)}>
          <BookOpenText size={16} aria-hidden="true" />
          {t("How do I do this?")}
        </button>
      )}
      <div className="row-actions">
        <button className="link" disabled={!inApp || locked} onClick={() => onHold(localDate(7))}>
          <Clock size={16} aria-hidden="true" />
          {t("Remind me in 7 days")}
        </button>
        <button className="link" disabled={!inApp || locked} onClick={() => onHold(null)}>
          <PushPin size={16} aria-hidden="true" />
          {action.currentVersion ? t("Stay on {version}", { version: action.currentVersion }) : t("Hide until I resume it")}
        </button>
      </div>
    </>
  );
}

export function Updates(props: {
  snapshot: Snapshot;
  busy: boolean;
  preselected: string[];
  onInstall(actionIds: string[], restorePoint: boolean): void;
  onHold(holds: Hold[]): Promise<void>;
  onOpenOverview(): void;
  onOpenGuide(id: GuideId): void;
}) {
  const { snapshot, busy, preselected, onInstall, onHold, onOpenOverview, onOpenGuide } = props;
  const actions = snapshot.plan?.actions ?? [];
  const stale = snapshot.plan ? ageInHours(snapshot.plan.report.generatedAt) > 24 : true;
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<Filter>("ready");
  // Retry from History arrives with its updates already chosen; the confirmation still lists them.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Remembered between installs; storage can be unavailable, and then it starts off.
  const [restorePoint, setRestorePoint] = useState(() => {
    try {
      return localStorage.getItem("restorePoint") === "on";
    } catch {
      return false;
    }
  });
  const chooseRestorePoint = (on: boolean) => {
    setRestorePoint(on);
    try {
      localStorage.setItem("restorePoint", on ? "on" : "off");
    } catch {
      // Kept for this session only.
    }
  };

  // Holding rebuilds the plan, so it waits for an install or audit to end, and for the last change.
  const [holding, setHolding] = useState(false);
  const locked = busy || holding;
  const changeHolds = (holds: Hold[]) => {
    setHolding(true);
    void onHold(holds).finally(() => setHolding(false));
  };
  const hold = (action: Action, until: string | null) => {
    setSelected((current) => {
      const next = new Set(current);
      next.delete(action.actionId);
      return next;
    });
    changeHolds([...snapshot.holds.filter((h) => h.actionId !== action.actionId), { actionId: action.actionId, title: action.title, until }]);
  };

  const visible = useMemo(
    () =>
      actions.filter((a) => {
        if (filter === "held") return false;
        if (filter === "ready") return a.command !== null;
        if (filter === "manual") return a.command === null;
        return a.risk === filter;
      }),
    [actions, filter],
  );

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const selectable = visible.filter((a) => a.command !== null && a.risk !== "high");
  const chosen = actions.filter((a) => selected.has(a.actionId));
  const focused = visible.find((a) => a.actionId === focusedId) ?? visible[0] ?? null;
  const filters: [Filter, string][] = [["ready", t("Ready")], ["manual", t("Needs you")], ["low", riskLabel("low")], ["medium", riskLabel("medium")], ["high", riskLabel("high")], ["held", t("On hold")]];

  if (!snapshot.plan) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">{t("Updates")}</h1>
        </div>
        <section className="pane first-run">
          <p className="empty">{t("Updates appear here after the first audit of this PC.")}</p>
          <button className="button" onClick={onOpenOverview}>
            <SquaresFour size={18} aria-hidden="true" />
            {t("Go to Overview")}
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("Updates")}</h1>
        <div className="segments" role="group" aria-label={t("Filter updates")}>
          {filters.map(([value, label]) => (
            <button key={value} className="segment" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </div>
      {stale && (
        <p className="notice">
          <WarningCircle size={20} aria-hidden="true" />
          <span>{t("This list is more than a day old. Audit this PC from Overview to install updates.")}</span>
        </p>
      )}

      <div className="master">
        <section className="pane update-list">
          {filter === "held" && snapshot.holds.length === 0 && (
            <p className="empty">{t("Nothing is on hold. Open an update to be reminded of it in a week, or to stay on the version you have.")}</p>
          )}
          {filter === "held" && snapshot.holds.length > 0 && (
            <ul className="rows">
              {snapshot.holds.map((h) => (
                <li className="row" key={h.actionId}>
                  <span className="row-title">{h.title}</span>
                  <span className="row-note">{h.until ? t("Back on {day}", { day: describeDay(h.until) }) : t("Until you resume it")}</span>
                  <div className="row-actions">
                    <button className="link" disabled={!inApp || locked} onClick={() => changeHolds(snapshot.holds.filter((other) => other.actionId !== h.actionId))}>
                      <ArrowCounterClockwise size={16} aria-hidden="true" />
                      {t("Resume")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {filter !== "held" && visible.length === 0 && <p className="empty">{t("No updates in this group.")}</p>}
          {groupBySource(visible).map(([source, items]) => (
            <div className="update-group" key={source}>
              <h2 className="group-title">
                {sourceName(source)}
                <span>{items.length}</span>
              </h2>
              {items.map((action) => {
                const runnable = action.command !== null && action.risk !== "high";
                const isFocused = focused?.actionId === action.actionId;
                return (
                  <div className="update" key={action.actionId} data-focused={isFocused || undefined}>
                    <input
                      type="checkbox"
                      aria-label={t("Select {title}", { title: action.title })}
                      disabled={!runnable}
                      checked={selected.has(action.actionId)}
                      onChange={() => toggle(action.actionId)}
                    />
                    <button className="update-open" aria-expanded={isFocused} onClick={() => setFocusedId(action.actionId)}>
                      <i className="risk-mark" data-risk={action.risk} data-manual={action.command === null} data-tip={riskLabel(action.risk)} />
                      <span className="row-title">{action.title}</span>
                      {versionsOf(action)}
                    </button>
                    {isFocused && <div className="update-inline"><ActionDetail action={action} locked={locked} onHold={(until) => hold(action, until)} onOpenGuide={onOpenGuide} /></div>}
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        {focused && (
          <aside className="pane inspector" aria-label={t("Selected update")}>
            <h2 className="inspector-title">{focused.title}</h2>
            {versionsOf(focused)}
            <ActionDetail action={focused} locked={locked} onHold={(until) => hold(focused, until)} onOpenGuide={onOpenGuide} />
          </aside>
        )}
      </div>

      <div className="dock" data-active={selected.size > 0 || undefined}>
        <span className="dock-count">{selected.size === 0 ? t("Choose updates to install") : tn(selected.size, "{n} selected", "{n} selected")}</span>
        {selected.size > 0 && <button className="link" onClick={() => setSelected(new Set())}>{t("Clear")}</button>}
        <button className="button" onClick={() => setSelected(new Set(selectable.map((a) => a.actionId)))}>{t("Select all shown")}</button>
        <button className="button button-primary" disabled={!inApp || busy || stale || selected.size === 0} onClick={() => dialog.current?.showModal()}>
          {t("Install {n} selected", { n: selected.size })}
        </button>
      </div>

      <dialog className="sheet" ref={dialog} aria-labelledby="confirm-title">
        <h2 className="sheet-title" id="confirm-title">{tn(selected.size, "Install {n} update?", "Install {n} updates?")}</h2>
        <ul className="rows sheet-list">
          {chosen.map((action) => (
            <li className="row" key={action.actionId}>
              <span className="row-title">{action.title}</span>
              {versionsOf(action) ?? <span />}
              <div className="confirm-note">
                <p>{riskLabel(action.risk)}, {action.reversible ? t("can be undone") : t("cannot be undone")}</p>
                {action.command && <Command text={action.command} />}
              </div>
            </li>
          ))}
        </ul>
        <div className="sheet-foot">
          <p>
            {t("Windows asks for permission once. Close the apps being updated first, or their updates can fail. If one fails, the rest still run.")}
            {chosen.some((a) => a.command?.startsWith("winget")) && ` ${t("Installing accepts the package and source agreements of the WinGet packages listed.")}`}
          </p>
          <p>{t("When it finishes, this PC is audited again to verify the result.")}</p>
          <label className="check">
            <input type="checkbox" checked={restorePoint} onChange={(e) => chooseRestorePoint(e.target.checked)} />
            <span>
              <b>{t("Create a restore point first")}</b>
              {t("Lets you take this PC back to how it is now. Windows makes at most one a day and needs System Protection on; if it can't, nothing is installed.")}
            </span>
          </label>
          <form method="dialog" className="sheet-actions">
            <button className="button">{t("Cancel")}</button>
            <button className="button button-primary" onClick={() => onInstall([...selected], restorePoint)}>{tn(selected.size, "Install {n} update", "Install {n} updates")}</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
