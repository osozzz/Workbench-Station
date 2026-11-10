import { BookOpenText, SquaresFour, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { ageInHours, inApp, sourceNames, type Action, type Risk, type Snapshot } from "../data";
import { guideForAction, type GuideId } from "../guides";
import { Command, groupBySource, versionsOf } from "../actions";

type Filter = "ready" | "manual" | Risk;

function ActionDetail({ action, onOpenGuide }: { action: Action; onOpenGuide(id: GuideId): void }) {
  const guide = guideForAction(action);
  const blocked = action.command !== null && action.risk === "high";
  return (
    <>
      <p className="detail-facts">
        <span data-risk={action.risk}>{action.risk} risk</span>
        <span>{action.reversible ? "Can be undone" : "Cannot be undone"}</span>
        <span>{sourceNames[action.source.type] ?? action.source.type}</span>
      </p>
      <p>{action.message}</p>
      {action.command ? <Command text={action.command} /> : <p className="detail-note">This one has no command. You do it yourself.</p>}
      {blocked && <p className="detail-note">High-risk updates do not run from here.</p>}
      {guide && (
        <button className="link" onClick={() => onOpenGuide(guide)}>
          <BookOpenText size={16} aria-hidden="true" />
          How do I do this?
        </button>
      )}
    </>
  );
}

export function Updates(props: {
  snapshot: Snapshot;
  busy: boolean;
  preselected: string[];
  onInstall(actionIds: string[]): void;
  onOpenOverview(): void;
  onOpenGuide(id: GuideId): void;
}) {
  const { snapshot, busy, preselected, onInstall, onOpenOverview, onOpenGuide } = props;
  const actions = snapshot.plan?.actions ?? [];
  const stale = snapshot.plan ? ageInHours(snapshot.plan.report.generatedAt) > 24 : true;
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState<Filter>("ready");
  // Retry from History arrives with its updates already chosen; the confirmation still lists them.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected));
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      actions.filter((a) => {
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
  const filters: [Filter, string][] = [["ready", "Ready"], ["manual", "Needs you"], ["low", "Low risk"], ["medium", "Medium risk"], ["high", "High risk"]];

  if (!snapshot.plan) {
    return (
      <>
        <div className="page-head">
          <h1 className="page-title">Updates</h1>
        </div>
        <section className="pane first-run">
          <p className="empty">Updates appear here after the first audit of this PC.</p>
          <button className="button" onClick={onOpenOverview}>
            <SquaresFour size={18} aria-hidden="true" />
            Go to Overview
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Updates</h1>
        <div className="segments" role="group" aria-label="Filter updates">
          {filters.map(([value, label]) => (
            <button key={value} className="segment" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </div>
      {stale && (
        <p className="notice">
          <WarningCircle size={20} aria-hidden="true" />
          <span>This list is more than a day old. Audit this PC from Overview to install updates.</span>
        </p>
      )}

      <div className="master">
        <section className="pane update-list">
          {visible.length === 0 && <p className="empty">No updates in this group.</p>}
          {groupBySource(visible).map(([source, items]) => (
            <div className="update-group" key={source}>
              <h2 className="group-title">
                {sourceNames[source] ?? source}
                <span>{items.length}</span>
              </h2>
              {items.map((action) => {
                const runnable = action.command !== null && action.risk !== "high";
                const isFocused = focused?.actionId === action.actionId;
                return (
                  <div className="update" key={action.actionId} data-focused={isFocused || undefined}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${action.title}`}
                      disabled={!runnable}
                      checked={selected.has(action.actionId)}
                      onChange={() => toggle(action.actionId)}
                    />
                    <button className="update-open" aria-expanded={isFocused} onClick={() => setFocusedId(action.actionId)}>
                      <i className="risk-mark" data-risk={action.risk} data-manual={action.command === null} data-tip={`${action.risk[0].toUpperCase()}${action.risk.slice(1)} risk`} />
                      <span className="row-title">{action.title}</span>
                      {versionsOf(action)}
                    </button>
                    {isFocused && <div className="update-inline"><ActionDetail action={action} onOpenGuide={onOpenGuide} /></div>}
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        {focused && (
          <aside className="pane inspector" aria-label="Selected update">
            <h2 className="inspector-title">{focused.title}</h2>
            {versionsOf(focused)}
            <ActionDetail action={focused} onOpenGuide={onOpenGuide} />
          </aside>
        )}
      </div>

      <div className="dock" data-active={selected.size > 0 || undefined}>
        <span className="dock-count">{selected.size === 0 ? "Choose updates to install" : `${selected.size} selected`}</span>
        {selected.size > 0 && <button className="link" onClick={() => setSelected(new Set())}>Clear</button>}
        <button className="button" onClick={() => setSelected(new Set(selectable.map((a) => a.actionId)))}>Select all shown</button>
        <button className="button button-primary" disabled={!inApp || busy || stale || selected.size === 0} onClick={() => dialog.current?.showModal()}>
          Install {selected.size} selected
        </button>
      </div>

      <dialog className="sheet" ref={dialog} aria-labelledby="confirm-title">
        <h2 className="sheet-title" id="confirm-title">Install {selected.size} {selected.size === 1 ? "update" : "updates"}?</h2>
        <ul className="rows sheet-list">
          {chosen.map((action) => (
            <li className="row" key={action.actionId}>
              <span className="row-title">{action.title}</span>
              {versionsOf(action) ?? <span />}
              <div className="confirm-note">
                <p>{action.risk} risk, {action.reversible ? "can be undone" : "cannot be undone"}</p>
                {action.command && <Command text={action.command} />}
              </div>
            </li>
          ))}
        </ul>
        <div className="sheet-foot">
          <p>
            Windows asks for permission once. Close the apps being updated first, or their updates can fail. If one fails, the rest still run.
            {chosen.some((a) => a.command?.startsWith("winget")) && " Installing accepts the package and source agreements of the WinGet packages listed."}
          </p>
          <p>When it finishes, this PC is audited again to verify the result.</p>
          <form method="dialog" className="sheet-actions">
            <button className="button">Cancel</button>
            <button className="button button-primary" onClick={() => onInstall([...selected])}>Install {selected.size} {selected.size === 1 ? "update" : "updates"}</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
