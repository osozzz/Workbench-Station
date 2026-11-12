import { invoke } from "@tauri-apps/api/core";

export type Risk = "low" | "medium" | "high";

export interface Action {
  order: number;
  actionId: string;
  kind: string;
  source: { type: string; policyKey: string | null };
  subjectId: string | null;
  title: string;
  currentVersion: string | null;
  targetVersion: string | null;
  command: string | null;
  risk: Risk;
  reversible: boolean;
  message: string;
}

export interface Plan {
  report: { generatedAt: string; audit: { toolVersion: string }; host: { name: string } };
  summary: { actionCount: number; lowRiskCount: number; mediumRiskCount: number; highRiskCount: number; manualCount: number };
  actions: Action[];
}

export interface Finding {
  policyKey: string;
  status: "compliant" | "deviation" | "unknown" | "not-evaluable";
  subjectId: string | null;
  message: string;
}

export interface Evaluation {
  summary: { findingCount: number; compliantCount: number; deviationCount: number; unknownCount: number; notEvaluableCount: number };
  findings: Finding[];
}

export type ActionResult = "succeeded" | "failed" | "skipped" | "not-run";

export interface LogAction {
  order: number;
  actionId: string;
  title: string;
  risk: Risk;
  result: ActionResult;
  reason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunLog {
  startedAt: string;
  mode: "dry-run" | "apply" | "apply-confirm-all";
  actions: LogAction[];
  preflight?: { blockingApps: { app: string; packageId: string }[] };
  restorePoint?: { result: "creating" | "created" | "recent" | "failed"; reason: string | null; createdAt: string | null };
}

export interface Snapshot {
  plan: Plan | null;
  evaluation: Evaluation | null;
  logs: RunLog[];
}

export const inApp = "__TAURI_INTERNALS__" in window;

/** What the app tells people when something fails: its own words, and the technical part to copy. */
export interface AppError {
  message: string;
  detail?: string;
}

const failureMessages: Record<string, string> = {
  "audit-failed": "The audit stopped before it finished. Check that this PC is online, then audit again.",
  "permission-declined": "Windows permission was declined, so nothing was installed. Install again and choose Yes when Windows asks.",
  "update-stopped": "The install stopped early. History shows what was installed. Audit this PC again before installing the rest.",
  "invalid-selection": "That selection can't be installed. Audit this PC again, then choose the updates once more.",
  "powershell-unavailable": "Windows PowerShell didn't start, so Workbench Station can't audit or install. Check that PowerShell isn't blocked on this PC.",
  unexpected: "Something unexpected stopped Workbench Station. Copy the details below and report it.",
};

/** Turns a command's coded failure, or any other error, into an AppError. */
export function describeFailure(reason: unknown, fallback?: string): AppError {
  if (reason && typeof reason === "object" && "code" in reason) {
    const { code, detail } = reason as { code: string; detail?: string };
    return { message: failureMessages[code] ?? failureMessages.unexpected, detail: detail || undefined };
  }
  const text = reason instanceof Error ? reason.message : String(reason);
  return fallback ? { message: fallback, detail: text } : { message: text };
}

async function read<T>(name: "plan" | "evaluation" | "logs"): Promise<T> {
  if (inApp) return invoke<T>("read_data", { name });
  const response = await fetch(`/__data/${name}`);
  return response.json() as Promise<T>;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [plan, evaluation, logs] = await Promise.all([read<Plan | null>("plan"), read<Evaluation | null>("evaluation"), read<RunLog[]>("logs")]);
  return { plan, evaluation, logs: logs ?? [] };
}

export const refresh = () => invoke<void>("refresh");
export const runUpdate = (actionIds: string[], restorePoint: boolean) => invoke<void>("update", { actionIds, restorePoint });
/** Saves the last audit as one Markdown file; resolves to where it was saved, or null if cancelled. */
export const exportReport = () => invoke<string | null>("export_report");
/** What changes in one version of a WinGet package, from its manifest in the WinGet catalog. */
export const releaseNotes = (pkg: string, version: string) =>
  invoke<{ notes: string | null; url: string | null }>("release_notes", { package: pkg, version });
/** Opens an https link in the default browser. */
export const openLink = (url: string) => invoke<void>("open_link", { url });
/** Updates that can run from here: what the Updates tab, the tray and notifications count. */
export const readyCount = (plan: Plan | null) => plan?.actions.filter((a) => a.command !== null).length ?? 0;

/** "scheduled-audit" when Task Scheduler started the app. */
export const launchMode = () => invoke<"normal" | "scheduled-audit">("launch_mode");

export type AuditSchedule = "off" | "daily" | "weekly";
export const auditSchedule = () => invoke<AuditSchedule>("audit_schedule");
export const setAuditSchedule = (frequency: AuditSchedule) => invoke<void>("set_audit_schedule", { frequency });

/** Sets the notification area icon's tooltip. */
export const setTrayStatus = (text: string) => (inApp ? invoke<void>("set_tray_status", { text }).catch(() => undefined) : Promise.resolve());

/** Whether closing the window keeps the app in the notification area. Off when storage is unavailable. */
export function keepsRunning(): boolean {
  try {
    return localStorage.getItem("closeToTray") === "on";
  } catch {
    return false;
  }
}

export function setKeepsRunning(on: boolean) {
  try {
    localStorage.setItem("closeToTray", on ? "on" : "off");
  } catch {
    // Kept for this session only.
  }
}

export const loadFolders = () => (inApp ? invoke<string[]>("read_data", { name: "folders" }) : Promise.resolve<string[]>([]));
export const saveFolders = (folders: string[]) => invoke<void>("save_folders", { folders });
export const pickFolder = () => invoke<string | null>("pick_folder");

export async function loadLatestLog(): Promise<RunLog | null> {
  const logs = await read<RunLog[]>("logs");
  return logs?.find((log) => log.mode !== "dry-run") ?? null;
}

export const sourceNames: Record<string, string> = {
  winget: "WinGet",
  chocolatey: "Chocolatey",
  "npm-registry": "npm and pnpm",
  toolchain: "Developer tools",
  editor: "Editors",
  wsl: "WSL",
  "windows-update": "Windows Update",
  policy: "Your standard",
  consolidation: "Duplicates",
};

export const sourceOrder = Object.keys(sourceNames);

export function ageInHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function describeAge(iso: string): string {
  const hours = ageInHours(iso);
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${Math.floor(hours)} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
