# Privacy

Workbench Station has no account, no telemetry and no server of its own. Your reports, settings and the names of your programs stay on this PC.

## What stays on this PC

- Audit reports, plans, inventories, update history and settings, in `%LOCALAPPDATA%\com.osozzz.workbenchstation` (desktop app) or `reports/` (command line).
- A report leaves this PC only when you export it yourself, for example to compare two PCs.

## What connects to the internet

| When | Where | What is sent |
|---|---|---|
| Once a day, if "Check for updates automatically" is on (Settings) | `github.com/osozzz/Workbench-Station` | A request for the latest version file. No data about this PC or your audits |
| When you choose Check for updates | Same as above | Same as above |
| During an audit | Public version sources: WinGet, `nodejs.org`, `registry.npmjs.org`, `pypi.org`, `api.github.com`, `go.dev`, `endoflife.date`, `dotnetcli.blob.core.windows.net`, `storage.googleapis.com`, `dl.google.com`, `api.foojay.io` | Requests for the latest version of each tool. The address names the tool, never you or this PC |
| When you install updates you chose | Each tool's own source, through its own installer (WinGet, npm, pip and others) | What that installer sends; see each tool's policy |

These services see the usual details of any web request, such as your IP address.

## Turning it off

- Automatic update checks: Settings → Check for updates automatically.
- Version lookups during an audit can't be turned off; without them the audit can't tell what is out of date. Without internet, the audit still runs and marks those versions as unknown.

## Uninstalling

Windows Settings → Apps → Installed apps → Workbench Station → Uninstall. The uninstaller also removes the scheduled audit and can delete your reports and settings.

## Contact

Open an issue at https://github.com/osozzz/Workbench-Station/issues.
