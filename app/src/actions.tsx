import { ArrowRight, Check, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { sourceOrder, type Action, type Risk } from "./data";
import { msg, t } from "./i18n";

const riskLabels: Record<Risk, string> = { low: msg("Low risk"), medium: msg("Medium risk"), high: msg("High risk") };

/** "Low risk", "Medium risk" or "High risk", in the app's language. */
export const riskLabel = (risk: Risk) => t(riskLabels[risk]);

export function groupBySource(actions: Action[]) {
  const groups = new Map<string, Action[]>();
  for (const action of actions) {
    groups.set(action.source.type, [...(groups.get(action.source.type) ?? []), action]);
  }
  return [...groups.entries()].sort(([a], [b]) => sourceOrder.indexOf(a) - sourceOrder.indexOf(b));
}

/** An exact command, shown before it runs, with a button to copy it. */
export function Command({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const code = useRef<HTMLElement>(null);
  const tip = copied ? t("Copied") : (label ?? t("Copy command"));
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="command">
      <code ref={code}>{text}</code>
      <button
        className="command-copy"
        aria-label={tip}
        data-tip={tip}
        onClick={() =>
          navigator.clipboard.writeText(text).then(
            () => setCopied(true),
            // Without clipboard access, select the command so Ctrl+C copies it.
            () => code.current && window.getSelection()?.selectAllChildren(code.current),
          )
        }
      >
        {copied ? <Check size={16} weight="bold" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function versionsOf(action: Action) {
  if (!action.currentVersion && !action.targetVersion) return null;
  return (
    <span className="versions">
      {action.currentVersion} <ArrowRight size={12} aria-label={t("to")} /> <b>{action.targetVersion}</b>
    </span>
  );
}
