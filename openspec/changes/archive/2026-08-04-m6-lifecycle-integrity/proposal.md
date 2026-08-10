## Why

M1–M5 delivered manifest/lock dual-read, resolve, install materialize, and cursor-only polish with `deployed_file_hashes` (lk-017 lite on frozen install). Consumer surface still lacks APM lifecycle/integrity CLI — `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit --ci`, `doctor` — so bapm cannot claim Consumer MUST cluster largely green on lifecycle fixtures. M6 closes that gap without opening a second host target or Producer/Governance scope.

## What Changes

- **`@b-apm/core`:** domain APIs for update (rs-011/rs-012 + lk-010 purge), outdated reporting, uninstall (manifest + modules + deploy cleanup + lock rewrite), prune (orphan modules not in resolved graph), deps inspect (list + tree; why SHOULD), audit CI gate (lock present + deployed presence + lk-017/sc-001 hash re-verify; exit 0/1), doctor basics (git + project artifact sanity)
- **`bapm` CLI (FEOD):** thin `commands/` handlers + `modules/` for `update`, `outdated`, `uninstall`, `prune`, `deps` (list|tree), `audit` (`--ci`), `doctor`; manual registry; help lists real commands (not stubs); unknown flags hard-error
- **Defaults for gaps:** `outdated` exit **0** even when outdated found (CI gate = `audit --ci`); `audit --ci` = lock + deployed presence + hashes (sc-001 subset); `lk-015` `tree_sha256` = SHOULD/soft, not blocking M6 accept; `deps why` = SHOULD if cheap else explicit defer note; `update` supports `--dry-run` and `-y` / minimal confirm path
- **HARD:** packages primarily `@b-apm/core` + CLI; touch `bapm-target-api` / `bapm-target-cursor` only if needed for hashes/cleanup; **MUST NOT** add new `bapm-target-*`
- **Non-goals:** Producer (M7), Governance/policy (M8), compile/MCP/marketplace (M9), registry/self-update (M10), rich audit scanners/SARIF/`--strip`, second host, range-widening aggressive update

## Capabilities

### New Capabilities

- `lifecycle-update`: Core + CLI `update` — full/scoped re-resolve (rs-011/rs-012), lk-010 install-path purge, `--dry-run` / `-y` / confirm, frozen refuse without override
- `lifecycle-outdated`: Core + CLI `outdated` — compare lock pins to remote tips; no lock → non-zero; outdated → report with exit 0
- `lifecycle-uninstall-prune`: Core + CLI `uninstall` (manifest/modules/deploy/lock) and top-level `prune` (orphan modules); both support `--dry-run`
- `deps-inspect`: Core + CLI `deps list` and `deps tree` (lock-backed MUST); `deps why` SHOULD (rs-005) if cheap
- `audit-integrity`: Core + CLI `audit --ci` gate — lock presence/consistency, deployed files present, hash re-verify (lk-017/sc-001); exit 0 clean / 1 violations; close M5 soft defer for audit path
- `doctor-basics`: Core + CLI `doctor` — git on PATH (critical), readable dual-read manifest/lock if present, modules dir sanity; non-zero on critical fail

### Modified Capabilities

- `cli-runtime-surface`: Register lifecycle commands; help lists `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`; hard-error unknown flags on new commands
- `cli-feod-architecture`: Thin command handlers + FEOD modules for new lifecycle surface; no business logic in `commands/` / `app/`
- `core-feod-architecture`: New/extended library modules under `packages/core` for lifecycle/integrity public APIs; no single-file modules; no core→cursor hard dep
- `dependency-resolve`: Explicit update scoping (rs-011/rs-012) and lk-010 purge-before-redownload for git-semver when update path requires it
- `install-pipeline`: Share/harden deployed-hash verify for audit `--ci` and uninstall/prune cleanup reuse; update path may compose install after resolve
- `target-package-architecture`: Reaffirm M6 allow-list — only `bapm-target-api` + `bapm-target-cursor`; forbid new hosts

## Impact

- **`@b-apm/core`:** new public symbols for update/outdated/uninstall/prune/deps/audit/doctor; Resolver/Install may gain scoped-update + purge hooks; Lockfile/Manifest edit helpers for uninstall; hash verify reused from Install inventory
- **`bapm` CLI:** new commands, constants, registry entries, help text; soft IoC via `app/init` + `app/integrations`
- **Targets:** incidental only (cleanup/hash paths already present); no new packages
- **Consumer claim:** lifecycle/integrity fixtures largely green; `lk-015` and rich audit deferred explicitly
- **Out of scope this phase:** production/acceptance code authored here; git commit
