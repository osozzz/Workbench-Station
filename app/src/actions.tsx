import { ArrowRight } from "@phosphor-icons/react";
import { sourceOrder, type Action } from "./data";

export function groupBySource(actions: Action[]) {
  const groups = new Map<string, Action[]>();
  for (const action of actions) {
    groups.set(action.source.type, [...(groups.get(action.source.type) ?? []), action]);
  }
  return [...groups.entries()].sort(([a], [b]) => sourceOrder.indexOf(a) - sourceOrder.indexOf(b));
}

export function versionsOf(action: Action) {
  if (!action.currentVersion && !action.targetVersion) return null;
  return (
    <span className="versions">
      {action.currentVersion} <ArrowRight size={12} aria-label="to" /> <b>{action.targetVersion}</b>
    </span>
  );
}
