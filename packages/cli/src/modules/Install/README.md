# Install

CLI Install module — thin FEOD wrapper over `@bapm/core` install + cursor
host materialize. Parses `--frozen`, `--no-frozen`, `--target <id>`, `--update`,
`--policy`, `--no-policy`, and an optional local pack `.zip` path (M7
install-from-archive); hard-errors unknown flags; rejects `--frozen`+`--no-frozen`
and effective-frozen+`--update`.

## Public API

- `createInstall` / `InstallApi`
- `parseInstallArgs` / `formatInstallHelp`

## CI-default frozen (lk-018)

Truthy `CI` (OpenAPM: present and not `""` / `"0"` / `"false"`) defaults install
to frozen via `@bapm/core` `resolveEffectiveFrozen`. Pass `--no-frozen` to opt out
(including under CI). Does not reopen P1 lk-015.

## Policy flags (M8)

- `--policy <path>` — explicit policy file (wins over dual-read siblings)
- `--no-policy` — skip gate (also `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1`)

Thin `bapm policy status` deferred — diagnostics surface via install/lock.

## Archive path

When argv includes a filesystem path ending in `.zip`, install extracts the
pack archive into the project root via `@bapm/core` Pack helpers, dual-read
parses the landed manifest, then continues existing install orchestration.

Cursor registration uses workspace dep `bapm-integration-cursor` here (not in core).
