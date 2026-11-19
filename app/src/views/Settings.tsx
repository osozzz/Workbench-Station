import { Check, Folder, FolderPlus, Trash } from "@phosphor-icons/react";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { auditSchedule, describeFailure, inApp, keepsRunning, setAuditSchedule, setKeepsRunning, type AppError, type AuditSchedule, type Update } from "../data";
import { useFolders } from "../folders";
import { languageChoice, t, type Language } from "../i18n";

export function Settings(props: {
  onError(error: AppError | null): void;
  onLanguage(choice: Language | "windows"): void;
  onCheckForUpdates(): Promise<Update | null>;
}) {
  const { onError, onLanguage, onCheckForUpdates } = props;
  const { folders, changed, add, remove } = useFolders(onError);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("Settings")}</h1>
      </div>
      <section className="pane settings">
        <div className="pane-head">
          <div>
            <h2 className="section-title">{t("Project folders")}</h2>
            <p className="pane-note">{t("The audit checks projects and Git repositories in these folders, and nowhere else.")}</p>
          </div>
          <button className="button" disabled={!inApp || folders === null} onClick={() => void add()}>
            <FolderPlus size={18} aria-hidden="true" />
            {t("Add folder")}
          </button>
        </div>
        <ul className="rows">
          {folders?.map((folder) => (
            <li className="row folder" key={folder}>
              <Folder size={20} aria-hidden="true" />
              <span className="row-title">{folder}</span>
              <button className="icon-button" aria-label={t("Remove {folder}", { folder })} data-tip={t("Remove folder")} onClick={() => void remove(folder)}>
                <Trash size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {folders?.length === 0 && <p className="empty">{t("No folders yet, so the audit skips projects and Git repositories.")}</p>}
        {changed && (
          <p className="saved">
            <Check size={16} weight="bold" aria-hidden="true" />
            {t("Saved. Audit this PC from Overview to apply this change.")}
          </p>
        )}
      </section>
      <AutomaticAudit onError={onError} />
      <LanguageSetting onLanguage={onLanguage} />
      <WindowSettings />
      <About onCheckForUpdates={onCheckForUpdates} />
    </>
  );
}

function AutomaticAudit({ onError }: { onError(error: AppError | null): void }) {
  const [schedule, setSchedule] = useState<AuditSchedule | null>(null);
  useEffect(() => {
    if (inApp) void auditSchedule().then(setSchedule, () => setSchedule("off"));
  }, []);
  const choose = (next: AuditSchedule) => {
    const before = schedule;
    setSchedule(next);
    onError(null);
    setAuditSchedule(next).catch((reason) => {
      setSchedule(before);
      onError(describeFailure(reason, t("Windows couldn't change the automatic audit.")));
    });
  };
  const schedules: [AuditSchedule, string][] = [
    ["off", t("Off")],
    ["daily", t("Daily")],
    ["weekly", t("Weekly")],
  ];

  return (
    <section className="pane settings">
      <div className="pane-head">
        <div>
          <h2 className="section-title">{t("Automatic audit")}</h2>
          <p className="pane-note">{t("Audits this PC in the background and tells you when updates are ready. It only reads; installing still waits for you.")}</p>
        </div>
        <div className="segments" role="group" aria-label={t("Automatic audit")}>
          {schedules.map(([value, label]) => (
            <button key={value} className="segment" aria-pressed={schedule === value} disabled={!inApp || schedule === null} onClick={() => choose(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {(schedule === "daily" || schedule === "weekly") && (
        <p className="pane-note">
          {schedule === "daily" ? t("Every day at noon, or as soon as this PC is on after that.") : t("Every Monday at noon, or as soon as this PC is on after that.")}
        </p>
      )}
    </section>
  );
}

/** Each language is named in its own language, so it can be found whichever one is showing. */
function LanguageSetting({ onLanguage }: { onLanguage(choice: Language | "windows"): void }) {
  const [choice, setChoice] = useState(languageChoice);
  const choices: [Language | "windows", string][] = [
    ["windows", t("Same as Windows")],
    ["en", "English"],
    ["es", "Español"],
  ];
  return (
    <section className="pane settings">
      <div className="pane-head">
        <div>
          <h2 className="section-title">{t("Language")}</h2>
          <p className="pane-note">{t("The names and messages of each update come from the audit and stay in English.")}</p>
        </div>
        <div className="segments" role="group" aria-label={t("Language")}>
          {choices.map(([value, label]) => (
            <button
              key={value}
              className="segment"
              aria-pressed={choice === value}
              onClick={() => {
                setChoice(value);
                onLanguage(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function WindowSettings() {
  const [on, setOn] = useState(keepsRunning);
  return (
    <section className="pane settings">
      <h2 className="section-title">{t("Window")}</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          disabled={!inApp}
          onChange={(e) => {
            setOn(e.target.checked);
            setKeepsRunning(e.target.checked);
          }}
        />
        <span>
          <b>{t("Keep running in the notification area when closed")}</b>
          {t("Closing the window only hides it. Open it again from the icon near the clock, and choose Quit there to close the app.")}
        </span>
      </label>
    </section>
  );
}

function About({ onCheckForUpdates }: { onCheckForUpdates(): Promise<Update | null> }) {
  const [version, setVersion] = useState<string | null>(null);
  const [check, setCheck] = useState<"idle" | "checking" | "latest" | "found" | "failed">("idle");
  useEffect(() => {
    if (inApp) void getVersion().then(setVersion, () => undefined);
  }, []);
  const checkNow = () => {
    setCheck("checking");
    onCheckForUpdates().then(
      (found) => setCheck(found ? "found" : "latest"),
      () => setCheck("failed"),
    );
  };

  return (
    <section className="pane settings">
      <div className="about-head">
        <span className="app-mark app-mark-large" aria-hidden="true" />
        <div>
          <h2 className="section-title">Workbench Station</h2>
          <p className="pane-note">{version ? t("Version {version}", { version }) : t("Version not available in this preview")}</p>
        </div>
        <button className="button" disabled={!inApp || check === "checking"} onClick={checkNow}>
          {check === "checking" ? t("Checking for updates…") : t("Check for updates")}
        </button>
      </div>
      {check === "latest" && <p className="pane-note">{t("This is the latest version.")}</p>}
      {check === "found" && <p className="pane-note">{t("A new version is ready. Use the notice at the top to restart to it.")}</p>}
      {check === "failed" && <p className="pane-note">{t("Couldn't check for updates. Check that this PC is online, then try again.")}</p>}
      <dl className="facts">
        <dt>{t("Publisher")}</dt>
        <dd>Alejandro Osorno</dd>
        <dt>{t("License")}</dt>
        <dd>MIT</dd>
        <dt>{t("Source code")}</dt>
        <dd>github.com/osozzz/Workbench-Station</dd>
        <dt>{t("Your data")}</dt>
        <dd>{t("Settings and reports stay on this PC, in %LOCALAPPDATA%\\com.osozzz.workbenchstation. Uninstalling from Windows Settings can delete them too.")}</dd>
      </dl>
    </section>
  );
}
