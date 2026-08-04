# Install

Install orchestration for `@bapm/core` (M5): frozen gate → resolve/download →
orphan cleanup → primitives discover/conflict → invoke registered targets via
`bapm-target-api` → write `deployed_file_hashes` when not frozen.

## Public API

- `runInstall` / `installProject`
- `enforceFrozen`
- `declaredTargetIds`
- `InstallError`
- `DEPLOYED_HASH_ALGO` / `hashFileBytes` — SHA-256 hex of file bytes for harness inventory

## Options

- `forcedTarget` / `forceTarget` — activate a registered target even when `detect` is false; unknown ids fail closed
- `frozen` — lk-006 pin gate + lk-017 lite re-verify of `deployed_file_hashes` when present (no lock rewrite)
- `archivePath` — local pack `.zip` path; extract into project root via Pack helper, then dual-read parse landed manifest and continue install orchestration (M7 install-from-archive)

## Boundaries

- Consumes Manifest / Lockfile / Resolver / Primitives / Pack only through public module APIs
- Speaks to hosts only through `bapm-target-api` — never imports `bapm-target-cursor`
- Inventory / cleanup helpers live under this module (`deployedInventory.ts`), not as a new top-level module
