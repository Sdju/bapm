# Init

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

CLI module for `bapm init` — scaffolds a minimal `bapm.yml` via `@b-apm/core` producer APIs.

## Public API

- `createInit(deps)` → `{ run, formatHelp }`
- Types: `InitDeps`, `InitOptions`, `InitResult`

Refuses when `apm.yml` or `bapm.yml` already exists. Optional `--target cursor` / `.cursor/` detect.
