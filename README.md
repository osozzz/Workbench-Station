# Workbench Station

Workbench Station keeps a Windows developer PC up to date with a declared standard. It is a desktop app (`app/`) on top of a PowerShell engine (`scripts/`), which also runs on its own from the command line. It audits what is installed, evaluates it against the workstation policy, and (in upcoming releases) plans and applies the updates. Comparing two PCs is available as an extra.

## Current phase

**v2.0.0 — Controlled Updates**

The toolkit audits a PC, evaluates it against `config/workstation.policy.json`, plans every available update (WinGet, Microsoft Store, Chocolatey, WSL, npm-registry CLIs, Python and Android tools, policy deviations), and applies the updates you select with `Run-Update.cmd`, confirming each one (`docs/policies/update-execution-safety.md`).

## Repository model

This public repository stores reusable scripts, policies, configuration, schemas, validation assets, and documentation only.

Generated audits, inventories, comparisons, machine names, local paths, and other workstation-specific outputs remain local to each clone and are excluded from version control.

## Documentation

Canonical documentation lives in `/docs`.

Start with:

- `docs/README.md`
- `docs/governance/repository-governance.md`
- `docs/governance/issue-project-model.md`
- `docs/releases/versioning-and-releases.md`
- `docs/policies/audit-safety.md`
- `docs/architecture/audit-system-roadmap.md`

The GitHub Wiki, when used, is a navigation/help layer only and must not override canonical repository documentation.

## Current audit system

The read-only audit covers Windows and PowerShell, WinGet applications and updates, JavaScript/Java/Flutter/Android/Python/.NET/Rust/Go toolchains, developer CLIs, PATH and approved environment variables, command precedence, local projects, Git health and hygiene, latest-version intelligence, policy evaluation, and an optional cross-PC comparison. The full coverage statement and its limitations are in `docs/architecture/audit-system-roadmap.md`.

## Quick start

```powershell
.\Run-Audit.cmd                                   # audit this PC; reports go to .\reports (ignored by Git)
.\Run-Evaluate.cmd <report.json>                  # evaluate the report against the workstation policy
.\Run-Plan.cmd <report.json>                      # list everything that can be updated (runs nothing)
.\Run-Update.cmd <update-plan.json> -Risk low     # preview updates; add -Apply to run them, confirming each
.\Run-Compare.cmd <reference.json> <target.json>  # optional: compare two audit reports
```

Optional project and Git discovery needs `config\workstation.local.json`; see `config/README.md`. The step-by-step procedure for auditing and evaluating a PC is in `docs/audit/running-the-audit.md`.

## Desktop app

Workbench Station (`app/`) is a Tauri app that does the same work without a terminal: it audits the PC, lists the updates, installs the ones you select, and shows live progress and past runs. **Compare** exports this PC's audit and compares it with an audit exported on another PC, both read-only. The app is in English and Spanish, following Windows unless you pick one in **Settings**; its text lives in `app/src/es.ts` and `app/src/guides.es.ts`, and `pnpm build` fails if a text has no Spanish. It only starts the scripts in `scripts/` and reads their reports, so every rule in `docs/policies/update-execution-safety.md` still applies.

```powershell
cd app
pnpm install
pnpm tauri dev     # run it from this repository
pnpm tauri build   # build the installer into app\src-tauri\target\release\bundle\nsis
```

Building needs Node.js, pnpm, and Rust. The installed app needs no terminal. On first run it asks for your project folders, so its audits include local project and Git discovery, and walks you through the first audit. It keeps those settings and its reports in `%LOCALAPPDATA%\com.osozzz.workbenchstation`, so they survive app updates.

The installer runs for the current user only, so it needs no administrator rights, and it is available in English and Spanish. It is not code-signed yet, so a downloaded copy shows a Windows SmartScreen warning: choose **More info**, then **Run anyway**. To remove the app, use **Settings > Apps** in Windows; the uninstaller can also delete your settings and reports.

The app icon and installer artwork come from `app/icon.svg` (`pnpm tauri icon icon.svg`) and `app/src-tauri/installer/`. The visual system (palette, type, glass, motion, voice) is documented in `DESIGN.md`.

## Roadmap

- `v0.1.0` — Initial Audit Skeleton
- `v0.2.0` — Repository Foundation
- `v0.3.0` — Audit Core
- `v0.4.0` — Runtime & SDK Detection
- `v0.5.0` — PATH & Environment Intelligence
- `v0.6.0` — Project & Git Discovery
- `v0.7.0` — Version Intelligence
- `v0.8.0` — Cross-PC Comparison
- `v0.9.0` — Audit Hardening
- `v1.0.0` — Baseline Ready
- `v1.1.0` — Policy Evaluation
- `v1.2.0` — Update Plan
- `v1.3.0` — Update Coverage
- `v2.0.0` — Controlled Updates
- `v2.1.0` — Batch Updates
- `v2.2.0` — Reliable Updates
- `v2.3.0` — Full Coverage

## Clone

With GitHub CLI:

```powershell
gh repo clone osozzz/Workbench-Station
cd Workbench-Station
```

Or with Git:

```powershell
git clone https://github.com/osozzz/Workbench-Station.git
cd Workbench-Station
```

## Repository workflow

- `main` is the only permanent branch.
- Changes use short-lived branches.
- Normal changes go through Pull Requests.
- Squash merge is the default strategy.
- Generated workstation outputs are never committed.
- Issues are the source of truth for executable work.
- Project fields handle planning metadata such as Status, Priority, Area, and Risk.
- Native parent/sub-issue and blocking relationships are preferred over duplicated status labels.

See `CONTRIBUTING.md` for the full workflow.

## Safety

Audit functionality is read-only by default.

It must not silently:

- install or uninstall software;
- modify PATH or environment variables;
- delete branches or worktrees;
- upgrade dependencies;
- rewrite Git history;
- expose arbitrary environment variables or secrets.

See `SECURITY.md` and `docs/policies/audit-safety.md`.

## License

MIT. See `LICENSE`.
