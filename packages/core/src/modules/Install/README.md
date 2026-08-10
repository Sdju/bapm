# Install

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Install orchestration for `@b-apm/core` (M5): frozen gate → resolve/download →
orphan cleanup → primitives discover/conflict → invoke registered targets via
`@b-apm/integration-api` → write `deployed_file_hashes` when not frozen.

## Public API

- `runInstall` / `installProject`
- `enforceFrozen`
- `isCiEnvTruthy` / `resolveEffectiveFrozen` — OpenAPM req-lk-018 CI-default frozen
- `declaredTargetIds`
- `declaredTargetIntegrationMap` — host→package map when object form is used (undefined for legacy); CLI loads/registers map packages before selection
- `InstallError`
- `DEPLOYED_HASH_ALGO` / `hashFileBytes` — SHA-256 hex of file bytes for harness inventory

## Options

- `forcedTarget` / `forceTarget` — activate a registered target even when `detect` is false; unknown ids fail closed
- `frozen` — lk-006 pin gate + lk-017 lite re-verify of `deployed_file_hashes` when present + lk-015 `tree_sha256` re-verify for git entries (no lock rewrite)
- `archivePath` — local pack `.zip` path; extract into project root via Pack helper, then dual-read parse landed manifest and continue install orchestration (M7 install-from-archive)
- `policyPath` / `policy` — explicit policy file (wins over dual-read `apm-policy.yml` | `bapm-policy.yml`)
- `noPolicy` — skip policy gate (`--no-policy` / `BAPM_POLICY_DISABLE=1`)

## CI-default frozen (lk-018)

OpenAPM SHOULD: when `CI` is truthy (present and not `""` / `"0"` / `"false"`,
case-insensitive), consumers default install to frozen unless an explicit
non-frozen opt-out applies. Use `isCiEnvTruthy(env)` and
`resolveEffectiveFrozen({ frozen?, noFrozen?, env })` at the call boundary
(CLI does this before `runInstall`). Passing `frozen: false` into
`runInstall` remains an explicit opt-out for tests/tools. Does not reopen P1
lk-015 (`tree_sha256` re-verify stays unchanged).

## Policy gate (M8)

After resolve **plan** (`skipDownload`), before `downloadPackages` and target deploy.
Modes: `off` | `warn` | `block`. See `@/modules/Policy`.

## Boundaries

- Consumes Manifest / Lockfile / Resolver / Primitives / Pack only through public module APIs
- Speaks to hosts only through `@b-apm/integration-api` — never imports `@b-apm/integration-cursor`
- Inventory / cleanup helpers live under this module (`deployedInventory.ts`), not as a new top-level module
