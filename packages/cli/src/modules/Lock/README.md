# Lock

CLI lock group: bare `bapm lock` (resolve + write lockfile, no deploy) and
`bapm lock export` (read-only SBOM via core `exportSbom`).

## Public API

- `createLock(deps)` — soft IoC factory (`resolveAndLock`, optional `exportSbom`)
- `parseLockArgs` — `--update`, `--verbose`/`-v`, `--parallel-downloads` (incl. `0` = serial), `--policy`, `--no-policy`
- `formatLockHelp` — usage including export + parallel `0`
