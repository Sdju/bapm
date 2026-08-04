# Install

Install orchestration for `@bapm/core` (M4): frozen gate → resolve/download →
primitives discover/conflict → invoke registered targets via `bapm-target-api` →
lock write when not frozen.

## Public API

- `runInstall` / `installProject`
- `enforceFrozen`
- `declaredTargetIds`
- `InstallError`

## Boundaries

- Consumes Manifest / Lockfile / Resolver / Primitives only through public module APIs
- Speaks to hosts only through `bapm-target-api` — never imports `bapm-target-cursor`
