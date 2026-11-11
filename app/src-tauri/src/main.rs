// The app only reads the reports and starts the repository's PowerShell scripts; every safety
// rule stays in those scripts (docs/policies/update-execution-safety.md).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::{
    fs,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const PERMISSION_DECLINED: i32 = 1223; // ERROR_CANCELLED

/// A failure the app explains in its own words: a stable code for the message, and the technical detail
/// people can copy into a report.
fn failure(code: &str, detail: impl ToString) -> Value {
    json!({ "code": code, "detail": detail.to_string() })
}

/// The folder that holds scripts/: the repository in development, the bundle when installed.
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return Ok(Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join(".."));
    }
    let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
    // resource_dir() starts with \?\, and Windows PowerShell's Join-Path fails on that prefix.
    Ok(dunce::simplified(&resources).join("workstation"))
}

/// The folder that holds reports/ and the local configuration: the repository in development, the
/// user's app data when installed, because an app update replaces the bundle.
fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return root(app);
    }
    app.path().app_local_data_dir().map_err(|e| e.to_string())
}

fn local_config(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_root(app)?.join("config").join("workstation.local.json"))
}

fn read_json(path: &Path) -> Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(text.trim_start_matches('\u{feff}')).ok())
        .unwrap_or(Value::Null)
}

#[tauri::command]
fn read_data(app: AppHandle, name: String) -> Result<Value, String> {
    let reports = data_root(&app)?.join("reports");
    match name.as_str() {
        "plan" => Ok(read_json(&reports.join("update-plan").join("update-plan.json"))),
        "evaluation" => Ok(read_json(&reports.join("evaluation").join("evaluation.json"))),
        // ponytail: every poll rereads all logs (about 40 KB each); read only the newest once they pile up.
        "logs" => {
            let mut paths: Vec<PathBuf> = fs::read_dir(reports.join("update-log"))
                .map(|entries| entries.flatten().map(|e| e.path()).collect())
                .unwrap_or_default();
            paths.retain(|p| p.extension().is_some_and(|e| e == "json"));
            paths.sort();
            paths.reverse();
            Ok(Value::Array(paths.iter().map(|p| read_json(p)).filter(|v| !v.is_null()).collect()))
        }
        "folders" => Ok(read_json(&local_config(&app)?).pointer("/projects/developmentRoots").cloned().unwrap_or_else(|| json!([]))),
        _ => Err(format!("Unknown data set: {name}")),
    }
}

/// Sets the folders the audit may scan and keeps every other setting. A whole drive is too broad, as in the audit.
fn with_folders(mut config: Value, folders: &[String]) -> Result<Value, String> {
    if let Some(folder) = folders.iter().find(|f| !Path::new(f).is_absolute() || Path::new(f).parent().is_none()) {
        return Err(format!("{folder} is too broad to scan. Choose a folder inside the drive."));
    }
    let invalid = || "The project settings file is not valid, so it was not changed.".to_string();
    config
        .as_object_mut()
        .ok_or_else(invalid)?
        .entry("projects")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(invalid)?
        .insert("developmentRoots".to_string(), json!(folders));
    Ok(config)
}

#[tauri::command]
fn save_folders(app: AppHandle, folders: Vec<String>) -> Result<(), String> {
    let path = local_config(&app)?;
    let current = if path.exists() { read_json(&path) } else { json!({ "schemaVersion": "1.0" }) };
    let text = serde_json::to_string_pretty(&with_folders(current, &folders)?).map_err(|e| e.to_string())?;
    fs::create_dir_all(path.with_file_name("")).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

/// Windows' folder picker. It blocks until closed, so it stays off the main thread.
#[tauri::command]
async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut picker = app.dialog().file();
        if let Some(window) = app.get_webview_window("main") {
            picker = picker.set_parent(&window);
        }
        picker.blocking_pick_folder().map(|folder| folder.to_string())
    })
    .await
    .map_err(|e| e.to_string())
}

/// Audit, evaluation and plan. Read-only, so it runs hidden and without elevation.
#[tauri::command]
async fn refresh(app: AppHandle) -> Result<(), Value> {
    let unexpected = |e: String| failure("unexpected", e);
    let script = root(&app).map_err(unexpected)?.join("scripts").join("Refresh-Workstation.ps1");
    let data = data_root(&app).map_err(unexpected)?;
    tauri::async_runtime::spawn_blocking(move || {
        // output() also gives the child an empty stdin, so nothing in the audit can wait for input.
        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"])
            .arg(&script)
            .arg("-DataDirectory")
            .arg(&data)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| failure("powershell-unavailable", e))?;
        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(failure("audit-failed", format!("Exit code {:?}. {}", output.status.code(), stderr.trim())))
        }
    })
    .await
    .map_err(|e| failure("unexpected", e))?
}

/// One readable file from the engine's own outputs: the audit, then the policy evaluation and the plan.
fn compose_report(audit: &str, evaluation: Option<&str>, plan: Option<&str>) -> String {
    let mut report = audit.trim_start_matches('\u{feff}').trim_end().to_string();
    for (title, text) in [("Policy evaluation", evaluation), ("Update plan", plan)] {
        if let Some(text) = text {
            report.push_str(&format!("\n\n## {title}\n\n```text\n{}\n```", text.trim_start_matches('\u{feff}').trim_end()));
        }
    }
    report.push('\n');
    report
}

/// The newest audit report: the Markdown files written straight into reports/.
fn latest_audit(reports: &Path) -> Option<PathBuf> {
    fs::read_dir(reports)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "md"))
        .max_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok())
        .map(|entry| entry.path())
}

/// Saves the last audit as one Markdown file where the person chooses. Returns where, or None if cancelled.
#[tauri::command]
async fn export_report(app: AppHandle) -> Result<Option<String>, String> {
    let reports = data_root(&app)?.join("reports");
    let Some(audit) = latest_audit(&reports) else {
        return Err("There's no audit to export yet. Audit this PC first.".to_string());
    };
    let read = |path: PathBuf| fs::read_to_string(path).ok();
    let report = compose_report(
        &fs::read_to_string(&audit).map_err(|e| e.to_string())?,
        read(reports.join("evaluation").join("evaluation.txt")).as_deref(),
        read(reports.join("update-plan").join("update-plan.txt")).as_deref(),
    );
    let name = format!("Workbench Station report {}.md", audit.file_stem().unwrap_or_default().to_string_lossy());

    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_file_name(name).add_filter("Markdown", &["md"]);
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let Some(target) = dialog.blocking_save_file() else { return Ok(None) };
        let target = target.into_path().map_err(|e| e.to_string())?;
        fs::write(&target, report).map_err(|e| e.to_string())?;
        Ok(Some(target.display().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// A WinGet package id or version: the characters winget-pkgs uses, and no empty or dot-only path segment.
fn is_manifest_part(part: &str) -> bool {
    !part.is_empty()
        && part.chars().all(|c| c.is_ascii_alphanumeric() || "._+-".contains(c))
        && part.split('.').all(|segment| !segment.is_empty())
}

/// A top-level field of a WinGet manifest, plain or as a `|-` block. Manifests are flat enough that this
/// covers the fields read here.
fn manifest_field(text: &str, key: &str) -> Option<String> {
    let mut lines = text.lines();
    while let Some(line) = lines.next() {
        let Some(value) = line.strip_prefix(key).and_then(|rest| rest.strip_prefix(':')) else { continue };
        let value = value.trim();
        let value = if value.starts_with('|') || value.starts_with('>') {
            let block: Vec<&str> = lines.take_while(|l| l.trim().is_empty() || l.starts_with(' ')).collect();
            let indent = block.iter().filter(|l| !l.trim().is_empty()).map(|l| l.len() - l.trim_start().len()).min().unwrap_or(0);
            block.iter().map(|l| l.get(indent..).unwrap_or("")).collect::<Vec<_>>().join("\n").trim_end().to_string()
        } else {
            value.trim_matches(|c| c == '"' || c == '\'').to_string()
        };
        return (!value.is_empty()).then_some(value);
    }
    None
}

/// Fetches one file from winget-pkgs with Windows' own curl. Ok(None) means the catalog doesn't have it.
fn fetch_manifest(path: &str) -> Result<Option<String>, String> {
    let curl = PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into())).join(r"System32\curl.exe");
    let url = format!("https://raw.githubusercontent.com/microsoft/winget-pkgs/master/manifests/{path}");
    let output = Command::new(curl)
        .args(["--fail", "--silent", "--proto", "=https", "--max-time", "15", "--max-filesize", "1000000", &url])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;
    match output.status.code() {
        Some(0) => Ok(Some(String::from_utf8_lossy(&output.stdout).into_owned())),
        Some(22) => Ok(None), // HTTP 404: no manifest for this version
        code => Err(format!("The WinGet catalog couldn't be reached (curl exit {code:?}).")),
    }
}

/// What changes in one version of a WinGet package, read from its manifest in the WinGet catalog:
/// the notes text and the vendor's release-notes link, each when the manifest has it.
#[tauri::command]
async fn release_notes(package: String, version: String) -> Result<Value, String> {
    if !is_manifest_part(&package) || !is_manifest_part(&version) {
        return Err(format!("Not a WinGet package: {package} {version}"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let first = package[..1].to_ascii_lowercase();
        let folder = format!("{first}/{}/{version}", package.replace('.', "/"));
        let empty = json!({ "notes": null, "url": null });
        let Some(versions) = fetch_manifest(&format!("{folder}/{package}.yaml"))? else { return Ok(empty) };
        let locale = manifest_field(&versions, "DefaultLocale").filter(|l| is_manifest_part(l)).unwrap_or_else(|| "en-US".into());
        let Some(manifest) = fetch_manifest(&format!("{folder}/{package}.locale.{locale}.yaml"))? else { return Ok(empty) };
        let notes = manifest_field(&manifest, "ReleaseNotes").map(|notes| notes.chars().take(6000).collect::<String>());
        let url = manifest_field(&manifest, "ReleaseNotesUrl").filter(|url| is_web_link(url));
        Ok(json!({ "notes": notes, "url": url }))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn is_web_link(url: &str) -> bool {
    url.starts_with("https://") && url.len() > 8 && !url.chars().any(|c| c.is_whitespace() || c.is_control())
}

/// Opens an https link in the default browser; the window itself never navigates away.
#[tauri::command]
fn open_link(app: AppHandle, url: String) -> Result<(), String> {
    if !is_web_link(&url) {
        return Err(format!("Not a web link: {url}"));
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// Action IDs reach a command line, so only the characters the plan contract allows get through.
fn is_action_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || "._+:-".contains(c))
}

/// Runs the selected actions with one UAC prompt. The script rechecks the plan, the allow-list and the count.
#[tauri::command]
async fn update(app: AppHandle, action_ids: Vec<String>, restore_point: bool) -> Result<(), Value> {
    if action_ids.is_empty() || !action_ids.iter().all(|id| is_action_id(id)) {
        return Err(failure("invalid-selection", action_ids.join(",")));
    }
    let unexpected = |e: String| failure("unexpected", e);
    let data_path = data_root(&app).map_err(unexpected)?;
    let quoted = |path: PathBuf| path.display().to_string().replace('\'', "''");
    let script = quoted(root(&app).map_err(unexpected)?.join("scripts").join("Update-Workstation.ps1"));
    let plan = quoted(data_path.join("reports").join("update-plan").join("update-plan.json"));
    let data = quoted(data_path);
    let inner = format!(
        "-NoProfile -ExecutionPolicy Bypass -File \"{script}\" -Plan \"{plan}\" -DataDirectory \"{data}\" -Action {} -Apply -ConfirmedCount {}{}",
        action_ids.join(","),
        action_ids.len(),
        if restore_point { " -RestorePoint" } else { "" }
    );
    // Start-Process -Wait drops the exit code; reading Handle keeps it on Windows PowerShell 5.1.
    let elevate = format!(
        "try {{ $p = Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -PassThru -ErrorAction Stop -ArgumentList '{inner}' }} \
         catch {{ exit {PERMISSION_DECLINED} }}; $null = $p.Handle; $p.WaitForExit(); exit $p.ExitCode"
    );

    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &elevate])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| failure("powershell-unavailable", e))?;
        match output.status.code() {
            Some(0) => Ok(()),
            Some(PERMISSION_DECLINED) => Err(failure("permission-declined", "Windows UAC prompt declined.")),
            code => Err(failure("update-stopped", format!("Exit code {code:?}. {}", String::from_utf8_lossy(&output.stderr).trim()))),
        }
    })
    .await
    .map_err(|e| failure("unexpected", e))?
}

fn main() {
    tauri::Builder::default()
        // Registered first, so a second launch only brings the open window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // Restores size, position and maximized state. Visibility stays with the app, which shows the
        // window once it has drawn.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // If the page never runs, the window still appears instead of staying hidden.
            let window = app.get_webview_window("main").expect("the main window exists");
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                let _ = window.show();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_data, save_folders, pick_folder, refresh, update, export_report, release_notes, open_link])
        .run(tauri::generate_context!())
        .expect("the Workbench Station window could not start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_notes_come_from_plain_and_block_fields() {
        let manifest = "PackageName: Git\nReleaseNotes: |-\n  Changes since v2.51\n    - nested\n\n  Bug Fixes\nReleaseNotesUrl: https://github.com/git/tag\n";
        assert_eq!(manifest_field(manifest, "ReleaseNotes").unwrap(), "Changes since v2.51\n  - nested\n\nBug Fixes");
        assert_eq!(manifest_field(manifest, "ReleaseNotesUrl").unwrap(), "https://github.com/git/tag");
        assert_eq!(manifest_field("DefaultLocale: 'en-US'\n", "DefaultLocale").unwrap(), "en-US");
        assert!(manifest_field(manifest, "Description").is_none());
    }

    #[test]
    fn only_catalog_names_and_web_links_get_through() {
        assert!(is_manifest_part("Python.Python.3.14") && is_manifest_part("4.96.3"));
        for bad in ["", "..", "a/b", "Git..Git", ".Git", "a b", "x&y"] {
            assert!(!is_manifest_part(bad), "{bad}");
        }
        assert!(is_web_link("https://github.com/x"));
        for bad in ["http://x", "file:///c:/", "https://", "https://a b", "javascript:alert(1)"] {
            assert!(!is_web_link(bad), "{bad}");
        }
    }

    #[test]
    fn the_report_keeps_the_audit_and_adds_what_exists() {
        let report = compose_report("\u{feff}# Audit\n\nbody\n", Some("Findings: 3\n"), None);
        assert!(report.starts_with("# Audit"));
        assert!(report.contains("## Policy evaluation\n\n```text\nFindings: 3\n```"));
        assert!(!report.contains("Update plan"));
    }

    #[test]
    fn saving_folders_keeps_the_other_settings() {
        let config = json!({ "projects": { "maxDiscoveryDepth": 3 }, "git": { "branchStaleDays": 30 } });
        let saved = with_folders(config, &[r"C:\code".to_string()]).unwrap();
        assert_eq!(saved["projects"]["developmentRoots"], json!([r"C:\code"]));
        assert_eq!(saved["projects"]["maxDiscoveryDepth"], 3);
        assert_eq!(saved["git"]["branchStaleDays"], 30);
    }

    #[test]
    fn a_whole_drive_or_a_relative_path_is_refused() {
        for folder in [r"C:\", r"D:\", r"\\server\share", "code", "C:"] {
            assert!(with_folders(json!({}), &[folder.to_string()]).is_err(), "{folder}");
        }
    }

    #[test]
    fn an_unreadable_settings_file_is_not_replaced() {
        assert!(with_folders(Value::Null, &[]).is_err());
        assert!(with_folders(json!({ "projects": [] }), &[]).is_err());
    }
}
