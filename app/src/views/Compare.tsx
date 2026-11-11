import { ArrowsLeftRight, Check, Export } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { compareWith, describeAge, describeFailure, exportAudit, inApp, loadComparison, type AppError, type Comparison, type Difference } from "../data";

const categories: [string, string][] = [
  ["application", "Apps"],
  ["component", "Tools"],
  ["version", "Versions"],
  ["path", "PATH"],
  ["environment", "Environment variables"],
  ["project", "Projects"],
  ["git", "Git repositories"],
  ["provider", "Checks"],
];

const kinds: Record<string, string> = {
  presence: "Installed",
  "installed-version": "Installed version",
  "available-version": "Update available",
  "upgrade-availability": "Has an update",
  "upgrade-status": "Update check",
  "inventory-status": "App list",
  "command-resolution": "Command found",
  installation: "Copy installed",
  state: "State",
  status: "Check result",
  "active-version": "Version in use",
  "discovered-version": "Copy found",
  "latest-stable": "Latest stable release",
  "latest-current": "Latest current release",
  "latest-lts": "Latest LTS release",
  "intelligence-status": "Latest-version check",
  "allowlisted-variable": "Value",
  "scope-health": "Entries",
  "scope-order": "Order",
  "duplicate-entries": "Repeated entries",
  "missing-entries": "Folders that don't exist",
  "persistent-cross-scope-duplicates": "Entries in both machine and user PATH",
  "command-precedence": "Which copy runs",
  "branch-hygiene": "Branches",
  "branch-upstream": "Current branch",
  divergence: "Ahead or behind",
  "worktree-state": "Uncommitted changes",
  "inspection-state": "Could be read",
};

type Filter = "all" | "reference-only" | "target-only" | "different";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** What a difference is about: the package, tool, variable or project, not an internal ID. */
function subjectOf(d: Difference): string {
  const named = [d.referenceValue, d.targetValue].map((v) => (isRecord(v) && typeof v.name === "string" ? v.name : null)).find(Boolean);
  if (named) return named;
  const subject = d.subjectId ?? "";
  for (const prefix of ["winget-package:", "path-precedence.command."]) if (subject.startsWith(prefix)) return subject.slice(prefix.length);
  if (d.category === "environment") return subject.toUpperCase();
  if (d.category === "path") return `${subject.replace("-", " and ")} PATH`;
  if (d.category === "git") return "A Git repository";
  return d.componentId ?? d.providerId;
}

/** One side's value in a few words, or null when it is an object with nothing to name it by. */
function shown(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return Array.isArray(value) ? `${value.length} ${value.length === 1 ? "entry" : "entries"}` : String(value);
  const version = isRecord(value.version) && typeof value.version.value === "string" ? value.version.value : null;
  if (version) return typeof value.path === "string" ? `${version} at ${value.path}` : version;
  // Which copy of a command runs: the folder it comes from.
  if (isRecord(value.activeResolution) && typeof value.activeResolution.pathKey === "string") return value.activeResolution.pathKey;
  for (const key of ["value", "name", "packageId", "branchHead", "command"]) if (typeof value[key] === "string") return value[key] as string;
  return null;
}

/** For two objects, the plain fields that differ, nested ones included, as "branch count: 3 → 10". */
function changedFields(a: unknown, b: unknown, path = ""): string[] {
  if (!isRecord(a) || !isRecord(b)) return [];
  const plain = (v: unknown) => v === null || v === undefined || typeof v !== "object";
  const words = (key: string) => key.replace(/([A-Z])/g, " $1").toLowerCase();
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => {
    const name = `${path}${words(key)}`;
    if (plain(a[key]) && plain(b[key])) return a[key] === b[key] ? [] : [`${name}: ${String(a[key] ?? "none")} → ${String(b[key] ?? "none")}`];
    return changedFields(a[key], b[key], `${name} `);
  });
}

function Detail({ d, other }: { d: Difference; other: string }) {
  // A value that only repeats the title ("Installed" rows) says nothing more.
  const subject = subjectOf(d).toLowerCase();
  const here = shown(d.referenceValue)?.toLowerCase() === subject ? null : shown(d.referenceValue);
  const there = shown(d.targetValue)?.toLowerCase() === subject ? null : shown(d.targetValue);
  const sides = (a: string | null, b: string | null) =>
    a === null && b === null ? null : (
      <p className="compare-detail">
        {a !== null && <span>This PC: {a}</span>}
        {b !== null && <span>{other}: {b}</span>}
      </p>
    );
  if (here !== null && there !== null && here !== there) return sides(here, there);
  const fields = changedFields(d.referenceValue, d.targetValue);
  if (fields.length > 0) return <p className="compare-detail">{fields.join(" · ")}</p>;
  // A state with no value ("partial" against "missing"); "Only on…" already says what presence would.
  if (d.relation === "reference-only" || d.relation === "target-only") return sides(here, there);
  const [a, b] = [here ?? d.referenceState, there ?? d.targetState];
  // The same words on both sides would only hide that the difference is in a list.
  return a === b ? null : sides(a, b);
}

export function Compare() {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState<"comparing" | "exporting" | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    loadComparison().then(setComparison, () => setComparison(null));
  }, []);

  const run = async (kind: "comparing" | "exporting") => {
    setBusy(kind);
    setError(null);
    setSavedTo(null);
    try {
      if (kind === "exporting") setSavedTo(await exportAudit());
      else {
        const result = await compareWith();
        if (result) {
          setComparison(result);
          setFilter("all");
        }
      }
    } catch (reason) {
      setError(describeFailure(reason));
    } finally {
      setBusy(null);
    }
  };

  const other = comparison?.target.host.name ?? "the other PC";
  const groups = useMemo(() => {
    const shownDifferences = (comparison?.differences ?? []).filter((d) => filter === "all" || d.relation === filter);
    return categories
      .map(([category, title]) => {
        const items = shownDifferences.filter((d) => d.category === category);
        items.sort((a, b) => subjectOf(a).localeCompare(subjectOf(b)) || a.kind.localeCompare(b.kind));
        return { category, title, items };
      })
      .filter((group) => group.items.length > 0);
  }, [comparison, filter]);

  const relationText: Record<string, string> = {
    "reference-only": "Only on this PC",
    "target-only": `Only on ${other}`,
    different: "Different",
    unknown: "Unknown on one PC",
    unavailable: "Not checked on one PC",
    "not-applicable": "Doesn't apply on one PC",
  };
  const filters: [Filter, string][] = [["all", "All"], ["reference-only", "Only here"], ["target-only", "Only there"], ["different", "Different"]];

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Compare</h1>
        {comparison && (
          <div className="segments" role="group" aria-label="Filter differences">
            {filters.map(([value, label]) => (
              <button key={value} className="segment" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
        )}
      </div>

      <section className="pane compare-start">
        <p>
          See how this PC differs from another one: apps, tools and versions, PATH, projects and Git. On the other PC, export its audit from
          Workbench Station, then compare with that file here. Nothing is installed or changed on either PC.
        </p>
        <div className="row-actions">
          <button className="button button-primary" disabled={!inApp || busy !== null} onClick={() => void run("comparing")}>
            <ArrowsLeftRight size={18} aria-hidden="true" />
            {busy === "comparing" ? "Comparing…" : "Compare with another PC"}
          </button>
          <button className="button" disabled={!inApp || busy !== null} onClick={() => void run("exporting")}>
            <Export size={18} aria-hidden="true" />
            Export this PC's audit
          </button>
        </div>
        <p className="detail-note">The exported file has this PC's name, the folders of its tools and projects, and its Git branch names. Share it only with people you trust.</p>
      </section>

      {savedTo && (
        <p className="notice" role="status">
          <Check size={20} aria-hidden="true" />
          <span>Audit saved to {savedTo}. Open Workbench Station on the other PC and compare with this file.</span>
        </p>
      )}
      {error && (
        <p className="notice" data-tone="alert" role="alert">
          <span>{error.message}{error.detail && ` ${error.detail}`}</span>
        </p>
      )}

      {comparison && (
        <section className="pane update-list" aria-label="Differences">
          <p>
            <b>This PC</b> and <b>{other}</b>
            {comparison.summary.differenceCount === 0
              ? " have no differences."
              : `: ${comparison.summary.differenceCount} ${comparison.summary.differenceCount === 1 ? "difference" : "differences"}.`}{" "}
            {other}'s audit is from {describeAge(comparison.target.generatedAt)}, this PC's from {describeAge(comparison.reference.generatedAt)}.
          </p>
          {comparison.summary.differenceCount > 0 && groups.length === 0 && <p className="empty">No differences of this kind.</p>}
          {groups.map(({ category, title, items }) => (
            <div className="update-group" key={category}>
              <h2 className="group-title">
                {title}
                <span>{items.length}</span>
              </h2>
              <ul className="rows">
                {items.map((d, index) => (
                  <li className="row" key={`${d.providerId}|${d.componentId}|${d.subjectId}|${d.kind}|${index}`}>
                    <span className="row-title">
                      {subjectOf(d)} <span className="row-note">{kinds[d.kind] ?? d.kind.replaceAll("-", " ")}</span>
                    </span>
                    <span className="row-note">{relationText[d.relation] ?? d.relation}</span>
                    <Detail d={d} other={other} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
