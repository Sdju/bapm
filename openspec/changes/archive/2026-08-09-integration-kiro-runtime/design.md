## Context

See proposal.md — Why. APM reference: `KNOWN_TARGETS["kiro"]` in `integration/targets.py`, `adapters/client/kiro.py` (MCP translate + opt-in `.kiro/`), `integration/kiro_hook_integrator.py` (v1 per-file hooks), agent tools vocabulary in `agent_integrator.KIRO_AGENT_ALLOWED_TOOLS`. bapm patterns: `@bapm/integration-copilot` (translate MCP / `mcpEnvMode`), `@bapm/integration-claude` (native skills under host root, project MCP opt-in).

## Goals / Non-Goals

**Goals:**

- Greenfield `@bapm/integration-kiro` with detect / materialize / configureMcp / thin compile.
- APM Kiro v3 path parity for supported primitives (steering, agents, skills, hooks, MCP).
- Fail-closed agent tools gate; skip prompts/commands.

**Non-Goals:**

- User-scope `~/.kiro/` materialize/MCP.
- Legacy non-v3 hook documents (`when`/`then`).
- Marketplace pack mapper.
- Core/CLI eager registration or new `mcpEnvMode` API (reuse translate).

## Decisions

1. **Package shape** — Mirror `integration-copilot`: `createKiroIntegration` + `createIntegration` alias, vite-plus pack, dependency only `@bapm/integration-api`.
   - _Alternative:_ extend an existing package — rejected (no shared host root).

2. **Detect** — `existsSync(.kiro) && isDirectory()` only (APM `detect_by_dir` / `auto_create=False`).
   - _Alternative:_ signal whitelist of subdirs — rejected; APM uses the folder itself.

3. **Steering transform** — Parse YAML frontmatter; map `applyTo` → `inclusion: fileMatch` + `fileMatchPattern` list; else `inclusion: always`. Drop unrelated FM keys that are not part of Kiro steering contract when rewriting (keep body).
   - _Alternative:_ verbatim copy — rejected (APM `kiro_steering` + output_compare tests).

4. **Agents** — Keep FM keys `{description, model, tools}`; strip `name`/unknown; validate tools against APM frozenset; on failure emit diagnostic and skip write (no mkdir for that agent).
   - _Alternative:_ warn-and-strip bad tools — rejected (OpenAPM req-tg-009 / APM fail-closed).

5. **Hooks** — Expand Claude/Cursor-like merged hook JSON into one v1 file per handler under `.kiro/hooks/`, filenames `{pkg}-{stem}-{eventSlug}-{n}.json`, scripts under `.kiro/hooks/{pkg}/…`, ownership sidecar `.kiro/bapm-hooks.json` (same spirit as Claude/Copilot).
   - _Alternative:_ write legacy `when`/`then` — rejected (out of scope / non-v3).

6. **MCP** — Project `.kiro/settings/mcp.json`; reuse Copilot-style `translateEnvPlaceholders`; skip when `.kiro/` absent; `mcpEnvMode: "translate"` so install bake skips literals.
   - _Alternative:_ home-only like Copilot — rejected (APM project path is primary; user-scope out of scope).

7. **Compile** — Thin root `AGENTS.md`, omit `/instruction/i` primitives (steering already deployed). Requires `"."` in `deployRoots` only if assert helpers need it for root file; prefer compile path validation without expanding materialize roots — follow Codex/Claude pattern (`deployRoots: [".kiro", "."]` if root write needs assert, else compile-only relative check).
   - _Decision:_ `deployRoots: [".kiro", "."]` to allow `AGENTS.md` under assert helpers if used; materialize paths stay under `.kiro/`.

8. **Commands/prompts** — No handlers that write; `command` / prompt-like types ignored (optional skip diagnostic).

## Risks / Trade-offs

- [Incomplete hook IR coverage] → Mitigate: support the same nested `hooks[Event][].hooks[]` shape used by Claude/Copilot tests; document unsupported events as pass-through trigger names via a small event map where APM defines one.
- [YAML frontmatter parsing edge cases] → Mitigate: minimal FM parse (same approach as Claude command/rules helpers); fail-closed agents on unparseable FM.
- [AGENTS.md last-writer-wins with Cursor/Codex] → Accept APM agents-family semantics; document in supported-hosts.

## Migration Plan

New opt-in package; no migration. Users add dependency + `targets.kiro`.

## Open Questions

None blocking — APM samples and tests define v3 layouts.
