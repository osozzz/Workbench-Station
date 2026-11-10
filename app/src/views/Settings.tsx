import { Check, Folder, FolderPlus, Trash } from "@phosphor-icons/react";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { inApp } from "../data";
import { useFolders } from "../folders";

export function Settings({ onError }: { onError(message: string | null): void }) {
  const { folders, changed, add, remove } = useFolders(onError);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Settings</h1>
      </div>
      <section className="pane settings">
        <div className="pane-head">
          <div>
            <h2 className="section-title">Project folders</h2>
            <p className="pane-note">The audit checks projects and Git repositories in these folders, and nowhere else.</p>
          </div>
          <button className="button" disabled={!inApp || folders === null} onClick={() => void add()}>
            <FolderPlus size={18} aria-hidden="true" />
            Add folder
          </button>
        </div>
        <ul className="rows">
          {folders?.map((folder) => (
            <li className="row folder" key={folder}>
              <Folder size={20} aria-hidden="true" />
              <span className="row-title">{folder}</span>
              <button className="icon-button" aria-label={`Remove ${folder}`} data-tip="Remove folder" onClick={() => void remove(folder)}>
                <Trash size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {folders?.length === 0 && <p className="empty">No folders yet, so the audit skips projects and Git repositories.</p>}
        {changed && (
          <p className="saved">
            <Check size={16} weight="bold" aria-hidden="true" />
            Saved. Audit this PC from Overview to apply this change.
          </p>
        )}
      </section>
      <About />
    </>
  );
}

function About() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (inApp) void getVersion().then(setVersion, () => undefined);
  }, []);

  return (
    <section className="pane settings">
      <div className="about-head">
        <span className="app-mark app-mark-large" aria-hidden="true" />
        <div>
          <h2 className="section-title">Workbench Station</h2>
          <p className="pane-note">{version ? `Version ${version}` : "Version not available in this preview"}</p>
        </div>
      </div>
      <dl className="facts">
        <dt>Publisher</dt>
        <dd>Alejandro Osorno</dd>
        <dt>License</dt>
        <dd>MIT</dd>
        <dt>Source code</dt>
        <dd>github.com/osozzz/Workbench-Station</dd>
        <dt>Your data</dt>
        <dd>Settings and reports stay on this PC, in %LOCALAPPDATA%\com.osozzz.workbenchstation. Uninstalling from Windows Settings can delete them too.</dd>
      </dl>
    </section>
  );
}
