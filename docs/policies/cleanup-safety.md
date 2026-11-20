# Cleanup safety

`scripts/Clean-Workstation.ps1` frees up space. The desktop app's Space view runs it; it also works from the command line. These rules live in the script and `scripts/Core/Cleanup.Core.psm1`, not in the app.

## Rules

- `-List` only reads. It measures each item and shows its exact command.
- `-Item` cleans one item and refuses to run without `-Confirmed`. The app asks for confirmation once per item, showing that command.
- Caches are cleaned by their own tools: `pnpm store prune`, `npm cache clean --force`, `python -m pip cache purge`, `dart pub cache clean --force` and `docker system prune -f`. Docker volumes are never removed (`--volumes` is never passed), because a volume can hold a database.
- Folders go to the Recycle Bin. If one doesn't fit there, Windows asks before deleting it for good.
- A build folder is accepted only when all of these hold. The script checks them again when it cleans, not only when it lists:
  - it is inside one of the project folders (`projects.developmentRoots` in the local configuration);
  - it isn't a link or junction;
  - its name is a known build output (`node_modules`, `target`, `.next`, `dist`, `build`, `bin`, `obj`, `.gradle`, `.venv` and others);
  - its project file is next to it (`package.json`, `Cargo.toml`, a `.csproj`…), or a Python environment holds `pyvenv.cfg`.
- Temporary files: only entries in `%TEMP%` unchanged for 7 days, to the Recycle Bin. Files in use stay.
- Items that need administrator rights ask Windows each time, and only the item's name reaches the elevated command line:
  - WSL and Docker disks: `wsl --shutdown`, then `diskpart` compacts each `.vhdx`. It refuses while Docker Desktop is running.
  - Windows Update leftovers: `Dism.exe /Online /Cleanup-Image /StartComponentCleanup`, without `/ResetBase`.
- The Recycle Bin and Downloads are only shown. Personal files are never touched.
- Results stay in `reports/space/`, out of the exported audit and the comparison.
