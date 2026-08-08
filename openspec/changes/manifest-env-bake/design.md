## Context

See `proposal.md`. Bake already resolves placeholders via `bakeMcpStringMap` (`overrides` → `process.env`). Install calls `bakeMcpServerMaps(server)` without manifest defaults. Top-level unknown keys are retained today; `env` should become a first-class validated field.

## Goals / Non-Goals

**Goals:** Parse/validate `env`; bake lookup falls back to `manifest.env`; install wires it; docs + tests.

**Non-Goals:** Nested placeholder expansion inside `env` values (v1 plain strings); writing manifest env wholesale into mcp.json; Agent Plugins path changes.

## Decisions

1. **Precedence: overrides → process.env → manifest.env**
   - Matches “доопределить”: ambient/CI secrets win; yml fills gaps for plugin placeholder names.
   - **Alt:** manifest wins — rejected (encourages committing secrets / shadows CI).

2. **Validate env keys as env-var names** — same shape as MCP env keys.
   - Values: strings only (including `""`); empty does not satisfy bake (same as empty process.env).

3. **Extend `BakeMcpStringMapOptions` with `manifestEnv`** (or `defaults`) — keep `overrides` for future CLI. Install passes `manifest.document.env`.

4. **bapm extension** — dual-read file may carry `env`; not claimed as OpenAPM wire.

## Risks / Trade-offs

- **[Risk] Secrets in git via `env:`** → Mitigation: docs warn; prefer process env.
- **[Risk] Confusion with MCP server `env:` block** → Mitigation: docs: top-level vs per-server.

## Migration Plan

- Additive; existing manifests unchanged.
- Archive sync into `mcp-env-bake` / `manifest-yaml-validate` / docs.

## Open Questions

- None blocking for v1.
