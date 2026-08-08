## Why

External plugins often declare MCP env with bake placeholders (`{bake:NAME}`, `${NAME}`). Consumer projects need a place in **`bapm.yml`** to **доопределить** those names without relying only on ambient process env — especially when wiring several plugins’ expected variable names. Top-level `env:` gives a project-scoped map for bake lookup.

## What Changes

- Add optional top-level **`env:`** mapping on `bapm.yml` / `apm.yml` (string keys → string values) as a **bapm extension** (retained/validated, not OpenAPM-required).
- During Cursor MCP install bake, resolve placeholders using: explicit bake overrides (if any) → non-empty **process.env** → non-empty **manifest `env`** (process wins; manifest fills gaps / “доопределяет”).
- Document that `env:` is for bake defaults / name wiring; prefer real secrets in the process environment (do not encourage committing secrets in git).
- **Non-goals:** recursive nested bake of `env` values in v1 (plain strings only); injecting manifest `env` into the MCP server process beyond placeholder bake; changing Agent Plugins secret-refuse; CLI flag for overrides (still optional later).

## Capabilities

### New Capabilities

- _(none — extend existing)_

### Modified Capabilities

- `manifest-yaml-validate`: Accept/validate top-level `env` mapping (string→string).
- `mcp-env-bake`: Bake lookup MUST consult manifest `env` after process env when resolving placeholders.
- `docs-openapm-boundary` (or user docs via apply tasks): Document `env:` as bapm extension for bake.

## Impact

- `@bapm/core` Manifest types/parse; `Mcp/bake` lookup; Install wire passes `manifest.env` into `bakeMcpServerMaps`
- Tests: parse + bake + install Cursor
- Docs: `config-manifest.md`
