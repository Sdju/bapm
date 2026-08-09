## Context

See `proposal.md`. Bake floor (`mcp-env-bake-time`, `{bake:NAME}`) already resolves placeholders via `bakeMcpStringMap` (`overrides` → `process.env` / `options.env`). Install calls `bakeMcpServerMaps(server, { mode })` **without** manifest defaults.

**Partial floor already on master (reconcile, do not widen):**

- `BapmManifest` already declares `env?: Record<string, string>` (JSDoc: overlay deep-merge, local keys win).
- `bapm.local.yml` already allowlists `env` and deep-merges it into the effective document.
- Overlay `validateOverlayEnv` checks string→string shape only (no env-safe key regex yet).
- Base `parseManifestDocument` does **not** yet validate top-level `env` (unknown/retained via spread).
- User docs mention `env` only as an overlay allowlist entry — no bake precedence / no-secrets guidance for top-level `env:`.

## Goals / Non-Goals

**Goals:** Validate `env` on base parse; bake lookup falls back to effective `manifest.env`; install wires it; docs + tests.

**Non-Goals:** Nested placeholder expansion inside `env` values (v1 plain strings); writing manifest env wholesale into mcp.json; Agent Plugins path changes; new overlay semantics beyond what merge already does.

## Decisions

1. **Precedence: overrides → process.env → manifest.env**
   - Matches “доопределить”: ambient/CI secrets win; yml fills gaps for plugin placeholder names.
   - **Alt:** manifest wins — rejected (encourages committing secrets / shadows CI).

2. **Validate env keys as env-var names** — same shape as MCP / `{bake:NAME}` identifiers: `[A-Za-z_][A-Za-z0-9_]*`.
   - Values: strings only (including `""`); empty does not satisfy bake (same as empty process.env).
   - Implement in base parse; overlay merge already re-parses the effective document, so invalid overlay keys fail closed there. Prefer a shared helper if overlay early-validate is touched — no new overlay capability.

3. **Extend `BakeMcpStringMapOptions` with `manifestEnv`** (or `defaults`) — keep `overrides` for future CLI. Lookup: non-empty override → non-empty `options.env`/`process.env` → non-empty `manifestEnv`.

4. **Install wire uses effective document** — after load/overlay merge, pass `document.env` into `bakeMcpServerMaps` alongside `mode`. Do not read raw base YAML separately for bake.

5. **bapm extension** — dual-read file may carry `env`; not claimed as OpenAPM wire. Types already present: add validation + bake/install behavior only.

## Risks / Trade-offs

- **[Risk] Secrets in git via `env:`** → Mitigation: docs warn; prefer process env / local overlay for personal values.
- **[Risk] Confusion with MCP server `env:` block** → Mitigation: docs: top-level vs per-server.
- **[Risk] Assuming type work is unfinished** → Mitigation: tasks treat `env?` on `BapmManifest` as done; implement parse + bake + wire.

## Migration Plan

- Additive; existing manifests without `env` unchanged.
- Archive sync into `mcp-env-bake` / `manifest-yaml-validate`; docs via apply.

## Open Questions

- None blocking for v1.
