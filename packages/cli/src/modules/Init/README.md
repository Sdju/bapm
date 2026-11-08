# Init

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

CLI module for `bapm init` — scaffolds a minimal `bapm.yml` via `@b-apm/core` producer APIs and inventories existing agent harness content.

## Public API

- `createInit(deps)` → `{ run, formatHelp }`
- `discoverProject(cwd)` → `ProjectDiscoveryReport` (read-only)
- `parseInitArgs`, `formatInitHelp`
- Types: `InitDeps`, `InitOptions`, `InitResult`, `ProjectDiscoveryReport`

## Discovery

`bapm init --discover [--json]` detects canonical host markers, reads local `.apm/` primitives through `discoverPrimitives`, and scans host directories for skills, rules/instructions, commands, hooks, and MCP configs. It never loads host packages, uses the network, or writes files.

`bapm init --discover --apply` is explicit consent to create `bapm.yml` with the suggested `active` targets and empty dependencies. It refuses an existing `apm.yml` / `bapm.yml` and never deletes or moves existing files.

`bapm init` refuses when `apm.yml` or `bapm.yml` already exists. Optional `--target cursor` / `.cursor/` detect remains the thin scaffold path.
