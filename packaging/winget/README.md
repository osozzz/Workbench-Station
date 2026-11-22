# winget manifests

Manifests for the `Osoxyz.WorkbenchStation` package, laid out as in [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs) (`manifests/o/Osoxyz/WorkbenchStation/<version>/`). They describe the per-user NSIS installer of a published GitHub release.

Not submitted yet.

## A new version

1. Copy the last version folder and rename it to the new version.
2. In the three files, change `PackageVersion`. In the installer file, also change `ReleaseDate`, `InstallerUrl` and `InstallerSha256` (from the release's `SHA256SUMS.txt`, in uppercase). In the locale file, change `ReleaseNotesUrl`.
3. Validate: `winget validate --manifest packaging/winget/manifests/o/Osoxyz/WorkbenchStation/<version>`.

## Submitting

Each submission is a pull request from a fork of `microsoft/winget-pkgs` that adds the version folder under the same path. Microsoft's bots validate it and install it on a clean machine, and then a moderator reviews it. The first pull request may ask the author to accept the Microsoft CLA.
