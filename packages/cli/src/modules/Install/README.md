# Install

CLI Install module — thin FEOD wrapper over `@bapm/core` install + cursor
host materialize. Parses `--frozen`, `--target <id>`, `--update`, and an optional
local pack `.zip` path (M7 install-from-archive); hard-errors unknown flags;
rejects frozen+`--update`.

## Public API

- `createInstall` / `InstallApi`
- `parseInstallArgs` / `formatInstallHelp`

## Archive path

When argv includes a filesystem path ending in `.zip`, install extracts the
pack archive into the project root via `@bapm/core` Pack helpers, dual-read
parses the landed manifest, then continues existing install orchestration.

Cursor registration uses workspace dep `bapm-target-cursor` here (not in core).
