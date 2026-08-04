# Install

CLI Install module — thin FEOD wrapper over `@bapm/core` install + cursor
host materialize. Parses `--frozen`, `--target <id>`, `--update`; hard-errors
unknown flags; rejects frozen+`--update`.

## Public API

- `createInstall` / `InstallApi`
- `parseInstallArgs` / `formatInstallHelp`

Cursor registration uses workspace dep `bapm-target-cursor` here (not in core).
