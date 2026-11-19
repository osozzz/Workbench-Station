import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { msg, t } from "./i18n";

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

/** An update kept out of the plan: until the date it comes back (yyyy-MM-dd), or null to keep this version. */
export interface Hold {
  actionId: string;
  title: string;
  until: string | null;
}

export interface Snapshot {
  plan: Plan | null;
  evaluation: Evaluation | null;
  logs: RunLog[];
  holds: Hold[];
}

export const inApp = "__TAURI_INTERNALS__" in window;

/** What the app tells people when something fails: its own words, and the technical part to copy. */
export interface AppError {
  message: string;
  detail?: string;
}

const failureMessages: Record<string, string> = {
  "audit-failed": msg("The audit stopped before it finished. Check that this PC is online, then audit again."),
  "permission-declined": msg("Windows permission was declined, so nothing was installed. Install again and choose Yes when Windows asks."),
  "update-stopped": msg("The install stopped early. History shows what was installed. Audit this PC again before installing the rest."),
  "invalid-selection": msg("That selection can't be installed. Audit this PC again, then choose the updates once more."),
  "powershell-unavailable": msg("Windows PowerShell didn't start, so Workbench Station can't audit or install. Check that PowerShell isn't blocked on this PC."),
  "no-audit": msg("Audit this PC first, so there's something to export or compare."),
  "compare-failed": msg("That file couldn't be compared. Choose an audit exported from Workbench Station on the other PC (a .json file)."),
  "plan-failed": msg("The change was saved, but the list of updates couldn't be rebuilt. Audit this PC again to refresh it."),
  "folder-too-broad": msg("{detail} is too broad to scan. Choose a folder inside the drive."),
  "settings-invalid": msg("This PC's settings file can't be read, so it wasn't changed. Copy the details below and report it."),
  unexpected: msg("Something unexpected stopped Workbench Station. Copy the details below and report it."),
};

/** Turns a command's coded failure, or any other error, into an AppError in the app's language. */
export function describeFailure(reason: unknown, fallback?: string): AppError {
  if (reason && typeof reason === "object" && "code" in reason) {
    const { code, detail } = reason as { code: string; detail?: string };
    return { message: t(failureMessages[code] ?? failureMessages.unexpected, { detail: detail ?? "" }), detail: detail || undefined };
  }
  const text = reason instanceof Error ? reason.message : String(reason);
  return fallback ? { message: fallback, detail: text } : { message: text };
}

async function read<T>(name: "plan" | "evaluation" | "logs" | "holds" | "comparison"): Promise<T> {
  if (inApp) return invoke<T>("read_data", { name });
  const response = await fetch(`/__data/${name}`);
  return response.json() as Promise<T>;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [plan, evaluation, logs, holds] = await Promise.all([
    read<Plan | null>("plan"),
    read<Evaluation | null>("evaluation"),
    read<RunLog[]>("logs"),
    read<Hold[] | null>("holds"),
  ]);
  return { plan, evaluation, logs: logs ?? [], holds: activeHolds(holds ?? []) };
}

/** A local calendar date as yyyy-MM-dd, the form update holds use. */
export function localDate(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Holds still in force, as the engine reads them: one past its date no longer counts. */
const activeHolds = (holds: Hold[]) => holds.filter((hold) => hold.until === null || hold.until > localDate());

/** Saves the holds and rebuilds the plan from the last audit, so held updates leave the list. */
export const saveHolds = (holds: Hold[]) => invoke<void>("save_holds", { holds });

export const refresh = () => invoke<void>("refresh");
export const runUpdate = (actionIds: string[], restorePoint: boolean) => invoke<void>("update", { actionIds, restorePoint });
/** One difference between this PC (the reference) and another PC (the target), as the engine reports it. */
export interface Difference {
  category: string;
  kind: string;
  providerId: string;
  componentId: string | null;
  subjectId: string | null;
  relation: string;
  referenceState: string | null;
  targetState: string | null;
  referenceValue: unknown;
  targetValue: unknown;
}

interface Endpoint {
  generatedAt: string;
  host: { name: string };
}

export interface Comparison {
  reference: Endpoint;
  target: Endpoint;
  summary: { differenceCount: number };
  differences: Difference[];
}

/** The last comparison, kept in reports/comparison; null before the first one. */
export const loadComparison = () => read<Comparison | null>("comparison");
/** Asks for the other PC's exported audit and compares this PC with it; null if the picker was cancelled. */
export const compareWith = () => invoke<Comparison | null>("compare_with");
/** Saves this PC's last audit as JSON; resolves to where it was saved, or null if cancelled. */
export const exportAudit = () => invoke<string | null>("export_audit");
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

/** Sets the notification area icon's tooltip, and its menu in the app's language. */
export const setTrayStatus = (text: string) =>
  inApp ? invoke<void>("set_tray_status", { text, open: t("Open Workbench Station"), quit: t("Quit") }).catch(() => undefined) : Promise.resolve();

export type { Update };

/** A newer version from GitHub Releases, downloaded and verified, or null when this is the latest. */
export async function downloadAppUpdate(): Promise<Update | null> {
  markUpdateChecked();
  const update = await check();
  if (!update) return null;
  await update.download();
  return update;
}

/** Runs the downloaded installer, which closes the app and opens the new version. */
export async function installAppUpdate(update: Update) {
  await update.install();
  await relaunch();
}

const updateCheckKey = "updateCheckedAt";

function markUpdateChecked() {
  try {
    localStorage.setItem(updateCheckKey, String(Date.now()));
  } catch {
    // Without storage, the app checks at every start.
  }
}

/** Whether a day has passed since the last check for a new version of the app. */
export function updateCheckDue(): boolean {
  try {
    return !(Number(localStorage.getItem(updateCheckKey)) > Date.now() - 86_400_000);
  } catch {
    return true;
  }
}

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

const sourceNames: Record<string, string> = {
  winget: "WinGet",
  chocolatey: "Chocolatey",
  "npm-registry": msg("npm and pnpm"),
  toolchain: msg("Developer tools"),
  editor: msg("Editors"),
  wsl: "WSL",
  "windows-update": "Windows Update",
  policy: msg("Your standard"),
  consolidation: msg("Duplicates"),
};

/** Where an update comes from, in the app's language. */
export const sourceName = (type: string) => t(sourceNames[type] ?? type);

export const sourceOrder = Object.keys(sourceNames);

export function ageInHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

