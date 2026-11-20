# Contributing

This repository currently has a single human project owner and maintainer: **Alejandro Osorno (`@osozzz`)**.

## Source of truth

Before changing audit behavior, repository governance, normalized schemas, security boundaries, version/update policy, or release scope, read the relevant canonical documents in `/docs`.

Authority order:

1. approved decisions/ADRs;
2. canonical repository documentation;
3. implementation specifications;
4. implementation notes;
5. existing code.

Existing code does not override an approved specification.

## Workflow

1. Start from an assigned GitHub Issue when the work is part of the roadmap.
2. Confirm acceptance criteria and dependencies.
3. Start from the latest `main`.
4. Ensure the relevant local worktree is clean before migrations or destructive operations.
5. Create a short-lived branch.
6. Keep the change scoped to the Issue or governance task.
7. Add or update tests/validation required by the affected contract.
8. Update canonical documentation when behavior, policy, or architecture changes.
9. Open a Pull Request.
10. Resolve review findings and required checks.
11. Squash merge after the PR is ready.
12. Delete the merged branch.

Do not create permanent `develop`, `staging`, or release branches.

## Branch naming

Use a concise intent prefix:

- `feat/...`
- `fix/...`
- `docs/...`
- `test/...`
- `refactor/...`
- `chore/...`
- `ci/...`
- `build/...`
- `perf/...`
- `security/...`

Prefer issue-aware names once the backlog is established, for example:

```text
feat/42-java-detector
fix/57-path-collision
chore/18-repository-rules
```

## Commit convention

Use Conventional Commit-style intent:

```text
feat: add Java installation discovery
fix: handle missing PATH entries safely
docs: document audit provider contract
test: validate normalized detector output
refactor: extract command resolution provider
chore: update workstation policy baseline
ci: add PowerShell static analysis
security: harden report redaction
```

Commits should describe the actual change clearly.

## Authorship policy

The human project owner remains responsible for project work.

Automated tools must not add authorship/co-authorship trailers, credit notices, generated-by notices, promotional attribution, badges, or equivalent provenance metadata unless explicitly required for a specific dependency or legal reason.

## Worktree and branch hygiene

Before destructive actions or environment migrations:

- the working tree must be clean;
- staged changes must be understood;
- untracked files must be reviewed;
- unpushed commits must be surfaced;
- detached HEAD states must be surfaced;
- upstream state must be known.

Merged branches should be removed after merge.

Stale branches and stale/prunable worktrees will eventually be detected by the audit engine. Cleanup remains explicit and gated.

## Pull Requests

A PR should include:

- linked Issue where applicable;
- concise summary;
- scope;
- validation performed;
- documentation impact;
- workstation-policy impact;
- compatibility/migration impact;
- security/privacy impact;
- known limitations.

Do not bundle unrelated refactors into a PR.

## Building and testing

You need Windows 10 or 11 with Windows PowerShell 5.1 and PowerShell 7, [Pester](https://pester.dev) 6 and PSScriptAnalyzer, Node.js with pnpm, Rust (`app/src-tauri/rust-toolchain.toml` picks the version) and Python 3 for some validators.

The desktop app:

```powershell
cd app
pnpm install
pnpm tauri dev                          # run it from this repository
cargo build --bin workbench-space       # in app\src-tauri, once: the Space scanner the app starts
pnpm build                              # TypeScript, the Spanish check and the frontend build
pnpm tauri build                        # the installer, in app\src-tauri\target\release\bundle\nsis
```

The browser preview (`pnpm dev`) shows the app without Tauri, reading `reports/`. It never runs a command: the buttons that would are disabled. Point `WORKBENCH_REPORTS` at a folder of made-up reports for screenshots.

Tests, as CI runs them (`.github/workflows/validate.yml`):

```powershell
Invoke-Pester -Path tests/pester                                  # PowerShell 7
./tests/static-analysis/validate_psscriptanalyzer_gate.ps1
./tests/static-analysis/validate_windows_powershell_compatibility.ps1
cd app/src-tauri; cargo test
```

Run the Pester tests on Windows PowerShell 5.1 too, since `Run-Audit.cmd` and the app use it. There Pester loads by path: `Import-Module (Get-Module -ListAvailable Pester | Sort-Object Version -Descending | Select-Object -First 1).Path`. Scripts in `scripts/` stay ASCII only, because 5.1 reads a UTF-8 file without BOM as ANSI.

## Repository scope

Version reusable scripts, policies, configuration, documentation, schemas, fixtures, and validation assets.

Do not commit:

- machine-specific reports;
- exported workstation inventories;
- credentials or tokens;
- private package-registry credentials;
- local paths containing sensitive data;
- generated diagnostic output;
- real user secrets in fixtures.

## Security

Follow `SECURITY.md` and the security guidance under `/docs/policies` (and `/docs/security` once it exists).
