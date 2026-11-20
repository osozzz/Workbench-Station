# Security Policy

Workbench Station is a public repository with a desktop app and the PowerShell engine behind it, which audit and update developer workstations. Machine-specific diagnostics, environment inventories, local paths, and generated reports must remain local and must not be committed.

## Reporting a vulnerability

Do not publish exploitable details in a public Issue.

Use GitHub's private vulnerability reporting or security advisory capability when available, or contact the repository owner privately through the contact channel listed on the owner's GitHub profile.

Include, when possible:

- affected script, provider, workflow, or configuration surface;
- reproduction steps;
- expected vs. observed behavior;
- impact;
- suggested mitigation;
- whether the issue appears actively exploitable.

## Sensitive information

Never include passwords, MFA material, auth cookies, access or refresh tokens, provider secrets, private keys, production credentials, private package-registry credentials, or private source data in Issues, Pull Requests, logs, screenshots, fixtures, or reports committed to this repository.

Generated workstation outputs belong in local ignored directories only.

## Supported versions

Only the [latest release](https://github.com/osozzz/Workbench-Station/releases/latest) gets security fixes. The desktop app updates itself to it (unless automatic update checks are turned off in Settings), so the fix for a report ships as a new release, not a patch to an older one.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No; update to the latest |
| `main` | Yes, for the command-line engine run from a clone |

## Dependencies

Dependabot opens grouped update PRs every week for the desktop app's npm and Cargo packages and for GitHub Actions (`.github/dependabot.yml`). Security updates arrive as soon as an advisory is published.

Known advisories that do not affect the Windows app:

| Advisory | Package | Why it does not apply | Resolved by |
| --- | --- | --- | --- |
| [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g), unsound `VariantStrIter` | `glib` 0.18 | Tauri 2 uses GTK, and with it `glib`, only on Linux. The Windows build does not compile it. | Tauri 3, which moves to `glib` 0.20 or later |
| [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370), `proc-macro-error` unmaintained | `proc-macro-error` 1.0 | A build-time macro used only by `glib-macros` 0.18, so it is in the same Linux-only chain. | Tauri 3 |
