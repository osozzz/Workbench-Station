import { Broom, Check, ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Command } from "../actions";
import { describeFailure, inApp, listCleanup, loadCleanup, runCleanup, type AppError, type CleanupItem } from "../data";
import { describeAge, msg, t, tn } from "../i18n";
import { formatBytes } from "./Space";

const words: Record<string, { title: string; note: string; missing?: string }> = {
  "pnpm-store": { title: msg("pnpm store"), note: msg("Removes packages no project uses anymore. A project that needs one downloads it again."), missing: msg("pnpm isn't installed.") },
  "npm-cache": { title: msg("npm cache"), note: msg("npm downloads packages again when a project needs them."), missing: msg("npm isn't installed.") },
  "pip-cache": { title: msg("pip cache"), note: msg("pip downloads packages again when it needs them."), missing: msg("pip isn't installed.") },
  "pub-cache": { title: msg("Pub cache (Dart and Flutter)"), note: msg("Each project gets its packages back with pub get."), missing: msg("Dart and Flutter aren't installed.") },
  docker: { title: msg("Docker: unused data"), note: msg("Removes stopped containers, unused networks, dangling images and the build cache. Volumes are kept."), missing: msg("Start Docker to measure and clean it.") },
  temp: { title: msg("Temporary files"), note: msg("Files in your Temp folder that haven't changed in 7 days go to the Recycle Bin. Files in use stay."), missing: msg("Nothing older than 7 days.") },
  "build-folder": { title: "", note: msg("Goes to the Recycle Bin. The project builds it again (npm install, cargo build…) the next time you work on it.") },
  "wsl-disks": { title: msg("WSL and Docker disks"), note: msg("Closes WSL and compacts each virtual disk so it gives back the space it no longer uses. Quit Docker Desktop first."), missing: msg("No WSL or Docker disks on this PC.") },
  "windows-update": { title: msg("Windows Update leftovers"), note: msg("Removes old versions of Windows components that newer updates replaced. It can take several minutes.") },
  "recycle-bin": { title: msg("Recycle Bin"), note: msg("Empty it yourself when you're sure; Workbench Station never does.") },
  downloads: { title: msg("Downloads"), note: msg("Your files. Workbench Station only shows their size.") },
};

const groups: { title: string; ids: string[] }[] = [
  { title: msg("Caches"), ids: ["pnpm-store", "npm-cache", "pip-cache", "pub-cache", "docker", "temp"] },
  { title: msg("Build folders in your projects"), ids: ["build-folder"] },
  { title: msg("Needs administrator permission"), ids: ["wsl-disks", "windows-update"] },
  { title: msg("Only shown"), ids: ["recycle-bin", "downloads"] },
];

/** Build folders under this size are counted but not listed. */
const SMALL_FOLDER = 1024 * 1024;

const keyOf = (item: CleanupItem) => `${item.id}|${item.path ?? ""}`;
const titleOf = (item: CleanupItem) => (item.id === "build-folder" ? (item.path ?? "") : t(words[item.id]?.title ?? item.id));

function sizeOf(item: CleanupItem): string {
  if (item.bytes !== null) return formatBytes(item.bytes);
  if (item.footprint !== null && item.footprint > 0) return t("{size} now", { size: formatBytes(item.footprint) });
  return t("Known after it runs");
}

export function Cleanup({ onError }: { onError(error: AppError | null): void }) {
  const [items, setItems] = useState<CleanupItem[] | null>(null);
  const [measuredAt, setMeasuredAt] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});
  const [asking, setAsking] = useState<CleanupItem | null>(null);
  const sheet = useRef<HTMLDialogElement>(null);

  // The last measure shows right away; sizes may have changed since, so it says when it was taken.
  useEffect(() => {
    loadCleanup().then((last) => {
      if (last?.items) {
        setItems(last.items);
        setMeasuredAt(last.generatedAt);
      }
    }, () => undefined);
  }, []);

  const find = async () => {
    setFinding(true);
    onError(null);
    try {
      const catalog = await listCleanup();
      setItems(catalog.items);
      setMeasuredAt(catalog.generatedAt);
      setDone({});
    } catch (reason) {
      onError(describeFailure(reason));
    } finally {
      setFinding(false);
    }
  };

  const ask = (item: CleanupItem) => {
    setAsking(item);
    sheet.current?.showModal();
    // Cancel starts focused, so Enter never cleans by accident.
    sheet.current?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
  };

  const clean = async () => {
    const item = asking;
    sheet.current?.close();
    if (!item) return;
    setRunning(keyOf(item));
    onError(null);
    try {
      const result = await runCleanup(item.id, item.path);
      setDone((before) => ({ ...before, [keyOf(item)]: result.freedBytes }));
    } catch (reason) {
      onError(describeFailure(reason));
    } finally {
      setRunning(null);
    }
  };

  const folders = (items ?? []).filter((item) => item.id === "build-folder");
  const hidden = folders.filter((item) => (item.bytes ?? 0) < SMALL_FOLDER);
  const shown = (ids: string[]) =>
    (items ?? [])
      .filter((item) => ids.includes(item.id) && !(item.id === "build-folder" && (item.bytes ?? 0) < SMALL_FOLDER))
      .sort((a, b) => (a.id === "build-folder" && b.id === "build-folder" ? (b.bytes ?? 0) - (a.bytes ?? 0) : 0));

  return (
    <section className="pane cleanup" aria-labelledby="cleanup-title">
      <div className="pane-head">
        <h2 className="section-title" id="cleanup-title">{t("Free up space")}</h2>
        <button className="button" disabled={!inApp || finding || running !== null} onClick={() => void find()}>
          <Broom size={18} aria-hidden="true" />
          {finding ? t("Measuring…") : items ? t("Measure again") : t("Find what can be cleaned")}
        </button>
      </div>
      <p className="pane-note">
        {t("Each item shows what it takes and the exact command. Nothing runs until you confirm it, one item at a time. Caches are cleaned by their own tools and folders go to the Recycle Bin.")}
        {measuredAt && ` ${t("Measured {age}.", { age: describeAge(measuredAt) })}`}
      </p>
      {finding && <p className="detail-note">{t("Measuring caches and project folders usually takes about a minute.")}</p>}

      {items &&
        groups.map((group) => {
          const rows = shown(group.ids);
          if (rows.length === 0 && !(group.ids.includes("build-folder") && hidden.length > 0)) return null;
          return (
            <div className="update-group" key={group.title}>
              <h3 className="group-title">{t(group.title)}</h3>
              {group.ids.includes("build-folder") && <p className="detail-note">{t(words["build-folder"].note)}</p>}
              <ul className="rows">
                {rows.map((item) => {
                  const key = keyOf(item);
                  const word = words[item.id];
                  const freed = done[key];
                  return (
                    <li className="row cleanup-row" key={key}>
                      <span className={item.id === "build-folder" ? "space-path" : "row-title"} title={item.path ?? undefined}>
                        {titleOf(item)}
                        {item.admin && <ShieldCheck size={16} className="cleanup-admin" aria-label={t("Asks for administrator permission")} />}
                      </span>
                      <span className="row-note space-size">{sizeOf(item)}</span>
                      <p>
                        {item.id === "build-folder"
                          ? item.lastUsed && t("Last changed {age}.", { age: describeAge(item.lastUsed) })
                          : !item.available && word?.missing
                            ? t(word.missing)
                            : t(word?.note ?? "")}
                      </p>
                      {!item.showOnly && item.available && (
                        <div className="cleanup-action">
                          <Command text={item.command} />
                          {freed !== undefined ? (
                            <span className="cleanup-done" role="status">
                              <Check size={16} aria-hidden="true" />
                              {freed > 0 ? t("Freed {size}", { size: formatBytes(freed) }) : t("Done")}
                            </span>
                          ) : (
                            <button className="button" disabled={running !== null || finding} onClick={() => ask(item)}>
                              {running === key ? t("Cleaning…") : t("Clean…")}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {group.ids.includes("build-folder") && hidden.length > 0 && (
                <p className="detail-note">{tn(hidden.length, "{n} smaller folder under 1 MB isn't listed.", "{n} smaller folders under 1 MB aren't listed.")}</p>
              )}
            </div>
          );
        })}

      <dialog className="sheet close-guard cleanup-confirm" ref={sheet} aria-labelledby="cleanup-confirm" onClose={() => setAsking(null)}>
        {asking && (
          <>
            <h2 className="sheet-title" id="cleanup-confirm">
              {asking.id === "build-folder" ? t("Send this folder to the Recycle Bin?") : t("Clean {name}?", { name: titleOf(asking) })}
            </h2>
            {asking.path && asking.id === "build-folder" && <p className="space-path cleanup-confirm-path">{asking.path}</p>}
            <p>{t(words[asking.id]?.note ?? "")}</p>
            <Command text={asking.command} />
            {asking.admin && <p className="detail-note">{t("Windows will ask for administrator permission.")}</p>}
            <div className="close-guard-actions">
              <button className="button" data-cancel onClick={() => sheet.current?.close()}>{t("Cancel")}</button>
              <button className="button button-primary" onClick={() => void clean()}>{t("Clean")}</button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
