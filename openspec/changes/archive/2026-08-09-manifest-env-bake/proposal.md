## Why

External plugins often declare MCP env with bake placeholders (`{bake:NAME}`, `${NAME}`). Consumer projects need a place in **`bapm.yml`** to **доопределить** those names without relying only on ambient process env — especially when wiring several plugins’ expected variable names. Top-level `env:` gives a project-scoped map for bake lookup.

## What Changes

- Treat optional top-level **`env:`** on `bapm.yml` / `apm.yml` (string keys → string values) as a validated **bapm extension** for bake defaults (not OpenAPM-required).
- During install MCP bake, resolve placeholders using: explicit bake overrides (if any) → non-empty **process.env** → non-empty **effective manifest `env`** (process wins; manifest fills gaps / “доопределяет”).
- Document that `env:` is for bake defaults / name wiring; prefer real secrets in the process environment (do not encourage committing secrets in git).
- **Non-goals:** recursive nested bake of `env` values in v1 (plain strings only); injecting manifest `env` into the MCP server process beyond placeholder bake; changing Agent Plugins secret-refuse; new CLI flag for overrides (still optional later); redesign of `bapm.local.yml` (overlay already allowlists/merges `env`).

## Capabilities

### New Capabilities

- _(none — extend existing)_

### Modified Capabilities

- `manifest-yaml-validate`: Accept/validate top-level `env` mapping (string→string, env-safe keys).
- `mcp-env-bake`: Bake lookup MUST consult manifest `env` after process env when resolving placeholders.

User docs (`config-manifest.md`) are an apply-task deliverable via doc-expert — not a normative OpenSpec docs capability.

## Impact

- `@b-apm/core` Manifest parse validation for `env` (type + overlay merge already present on master — do not re-invent); `Mcp/bake` lookup; Install wire passes effective `document.env` into `bakeMcpServerMaps`
- Tests: parse + bake + install Cursor
- Docs: `config-manifest.md`
