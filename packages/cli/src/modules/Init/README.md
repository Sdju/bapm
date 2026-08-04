# Init

CLI module for `bapm init` — scaffolds a minimal `bapm.yml` via `@bapm/core` producer APIs.

## Public API

- `createInit(deps)` → `{ run, formatHelp }`
- Types: `InitDeps`, `InitOptions`, `InitResult`

Refuses when `apm.yml` or `bapm.yml` already exists. Optional `--target cursor` / `.cursor/` detect.
