## Context

See `proposal.md` for motivation. Today install collects MCP servers and `@b-apm/integration-cursor` `toCursorServerEntry` copies `server.env` verbatim into `.cursor/mcp.json`. APM Cursor uses legacy bake (`_supports_runtime_env_substitution = False`) via shared placeholder regexes in its client base adapter. Agent Plugins portable MCP already substitutes only `${PLUGIN_ROOT|PLUGIN_DATA}` and refuses secret-like keys — keep that path separate.

## Goals / Non-Goals

**Goals:**

- Shared bake helper in `@b-apm/core` for string maps (`env`, `headers`).
- Wire bake into the install → Cursor configureMcp path so durable mcp.json never keeps unresolved `${…}` / `<VAR>` placeholders.
- Fail closed with named missing vars; unit + install/integration tests.

**Non-Goals:**

- Translate-mode for other hosts; TTY Prompt.ask; `${input:…}` / single-brace `{name}` templates; CLI `--env` override floor (MAY add thin override inject later without blocking bake from `process.env`); changing Agent Plugins secret refuse.

## Decisions

1. **Bake in core before configureMcp, not only inside integration-cursor**
   - **Why:** Same collected MCP list should be host-agnostic once baked; Cursor is the only runtime writer today, but logic belongs with MCP/install domain.
   - **Alt:** Bake only in `toCursorServerEntry` — rejected as hiding OpenAPM parity in the integration package.

2. **Syntax parity with APM legacy env map values**
   - Support `${VAR}`, `${env:VAR}`, legacy `<VAR>` on **env/header string values**.
   - Do not bake `${VAR}` inside stdio `args` in this change (APM legacy leaves those largely untouched); keep scope to maps that carry secrets.
   - **Alt:** Full APM `_resolve_variable_placeholders` for args — deferred.

3. **Fail closed, no interactive prompt**
   - Missing var → error naming the var; no Prompt.ask (CI-safe).
   - **Alt:** Soft warn + leave placeholder — rejected (breaks APM Cursor intent and leaves useless mcp.json).

4. **Overrides hook, env default**
   - Resolver accepts optional `overrides: Record<string, string>`; install passes `process.env` (string values only). CLI flag for overrides is optional follow-up.
   - Empty string in env MUST NOT count as resolved for required placeholders.

5. **Diagnostics never print secret literals**
   - Messages name variable keys only.

## Risks / Trade-offs

- **[Risk] Literals land on disk in `.cursor/mcp.json`** → Mitigation: same as APM Cursor legacy; document that authors should prefer env placeholders in `bapm.yml` and that bake writes host config (gitignore guidance remains user responsibility).
- **[Risk] Partial multi-placeholder strings** → Mitigation: resolve all matches in a value; fail if any missing.
- **[Risk] Confusion with Agent Plugins refuse** → Mitigation: docs + tests keep boundaries separate; bake applies to consumer MCP deploy configs.

## Migration Plan

- No manifest format break: existing literal env keeps working; placeholder authors gain bake.
- Roll forward only; no lock migration.
- Docs: short note under MCP / config-manifest or policy-mcp situation.

## Open Questions

- Whether a thin CLI `--mcp-env KEY=VAL` (or APM-like overrides) ships in the same apply or immediately after — not required for floor bake from `process.env`.
