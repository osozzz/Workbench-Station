# Documentation

The `/docs` directory is the canonical documentation source for Workbench Station. The GitHub Wiki, when used, is a navigation and help layer only and must not override repository documentation. The [README](../README.md) is for people who use the app; this page is for people who work on it.

## Documentation map

- `architecture/` — system boundaries, provider model, data flow, and normalized schemas.
  - `architecture/policy-evaluation-contract.md` — normalized result of evaluating an audit report against the workstation policy.
  - `architecture/update-plan-contract.md` — normalized, read-only list of the updates one PC needs.
  - `architecture/audit-system-roadmap.md` — authoritative v1.0.0 coverage by category, version-intelligence availability, safety guarantees, and limitations.
- `audit/` — audit capabilities, detection coverage, comparison behavior, and safety requirements.
  - `audit/running-the-audit.md` — operator runbook: configure, audit a PC, evaluate it against the policy, and optionally compare it with another PC.
  - `audit/ci-coverage.md` — CI check names, what each covers, the required `validate` aggregator, and known coverage gaps.
  - `audit/powershell-static-analysis.md` — pinned PSScriptAnalyzer baseline, explicit exclusions, and CI gate behavior.
  - `audit/pester-testing.md` — direct core/provider contract testing conventions and deterministic CI behavior.
  - `audit/collection-safety.md` — StrictMode-safe collection idioms and the no-developer-tools audit regression.
  - `audit/schema-fixture-hardening.md` — normalized audit/comparison schema matrix, compatibility gates, fixture safety, and deterministic digests.
  - `audit/failure-path-testing.md` — controlled command, provider, discovery, malformed-result, and offline-source failure coverage, plus runtime provider-result validation.
  - `audit/privacy-testing.md` — report and comparison privacy boundaries, planted-canary checks, and committed-source secret scanning.
- `governance/` — repository workflow, issue/PR conventions, branch hygiene, and project management.
  - `governance/repository-governance.md` and `governance/issue-project-model.md` are the place to start.
- `policies/` — workstation standards and version/update policies.
  - `policies/workstation-policy.md` — the declared workstation standard, its schema, and the meaning of every key.
  - `policies/audit-safety.md` — what the read-only audit may and may not do.
  - `policies/update-execution-safety.md` — when and how the update executor may change a workstation (v2.0.0 onward).
  - `policies/cleanup-safety.md` — what Free up space may remove and how (v3.0.0 onward).
  - `policies/powershell-runtime.md` — supported PowerShell runtimes, how they are enforced, and handled runtime differences.
- `releases/` — versioning, milestones, release readiness, and changelog rules.
  - `releases/versioning-and-releases.md` — how versions and milestones are chosen.
- `security/` — planned home for security-specific implementation guidance that complements `SECURITY.md`; not created yet, so `SECURITY.md` and `policies/audit-safety.md` are authoritative today.
- `assets/` — the social preview and the README screenshots. Screenshots are taken from the browser preview with made-up reports (`WORKBENCH_REPORTS`, see below), never from a real PC.

## Current phase

`v3.0.0 — Desktop App`: the Tauri desktop app (`app/`) in English and Spanish, with updates, holds, an automatic audit, Compare, Space and Free up space, signed app updates and a release workflow. The engine keeps the guarantees of `v2.0.0 — Controlled Updates`: audit, evaluate, plan, and apply selected updates with confirmation.

Real workstation baselines are authoritative from v1.0.1 onward; changing a workstation remains outside the read-only audit.

## Repository model

This public repository stores reusable scripts, policies, configuration, schemas, validation assets, the desktop app and documentation only.

Generated audits, inventories, comparisons, machine names, local paths, and other workstation-specific outputs remain local to each clone (`reports/`, `config/workstation.local.json`) and are excluded from version control.

## Repository workflow

- `main` is the only permanent branch.
- Changes use short-lived branches, named `<type>/<issue>-<slug>`.
- Normal changes go through Pull Requests, with squash merge.
- Generated workstation outputs are never committed.
- Issues are the source of truth for executable work. Native parent/sub-issue and blocking relationships are preferred over duplicated status labels.
- Project fields handle planning metadata such as Status, Priority, Area, and Risk.

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full workflow.

## Audit guarantees

The audit is read-only. It must not silently:

- install or uninstall software;
- modify PATH or environment variables;
- delete branches or worktrees;
- upgrade dependencies;
- rewrite Git history;
- expose arbitrary environment variables or secrets.

See [`SECURITY.md`](../SECURITY.md) and `policies/audit-safety.md`.

## Desktop app

The app (`app/`) is Tauri 2 with React. It only starts the scripts in `scripts/` and reads their reports, so every rule in the policies above still applies. Its text lives in `app/src/es.ts` and `app/src/guides.es.ts`, and `pnpm build` fails when a text has no Spanish. The visual system (palette, type, glass, motion, voice) is in [`DESIGN.md`](../DESIGN.md). The icon and installer artwork come from `app/icon.svg` (`pnpm tauri icon icon.svg`) and `app/src-tauri/installer/`.

The browser preview (`pnpm dev`) serves the reports in `reports/`. Set `WORKBENCH_REPORTS` to another folder with the same layout to preview made-up data.

### Releasing the desktop app

One time: generate the update signing key with `cd app; pnpm tauri signer generate -w "$env:USERPROFILE\.tauri\workbench-station.key"`. Put its public key in `plugins.updater.pubkey` in `app/src-tauri/tauri.conf.json`. Add the private key and its password as the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and keep a backup outside the repository: without it, installed apps can't be updated again.

For each release:

1. Set the version in `VERSION`, `app/package.json`, `app/src-tauri/Cargo.toml` and `app/src-tauri/tauri.conf.json`, and rename `## Unreleased` in `CHANGELOG.md` to `## <version> — <date>`. Merge that.
2. Tag it: `git tag v<version>` and `git push origin v<version>`.
3. `.github/workflows/release.yml` checks that the tag matches the app version and builds the signed installer. It then creates a **draft** release with the installer, its `.sig`, `latest.json`, `SHA256SUMS.txt` and the CHANGELOG section as notes, and attests the installer's build provenance.
4. Review the draft and publish it. Installed apps find it within a day.

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
- `v3.0.0` — Desktop App
