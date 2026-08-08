## Why

Gemini CLI is a first-class APM target (`gemini`) with project conventions under `.gemini/` / `.agents/` and compile to `GEMINI.md`, but bapm has no `@bapm/integration-gemini` package. Without it, users cannot opt in via `targets:` object-map, detect Gemini projects, materialize commands/skills/hooks, configure MCP in `.gemini/settings.json`, or compile instructions into `GEMINI.md`.

## What Changes

- Add greenfield workspace package `@bapm/integration-gemini` implementing `BapmIntegration` (`createGeminiIntegration` / `createIntegration`: `detect`, `materialize`, `configureMcp`, thin `compile`).
- Detect: project `.gemini/` directory **or** project-root `GEMINI.md` (no mkdir solely for detect).
- Materialize aligned with APM `KNOWN_TARGETS["gemini"]`:
  - commands → `.gemini/commands/<name>.toml` (prompt body + optional description; `$ARGUMENTS` → `{{args}}`)
  - skills → `.agents/skills/<name>/SKILL.md`
  - hooks → merge `.gemini/settings.json` (+ scripts under `.gemini/hooks/`, ownership sidecar `.gemini/bapm-hooks.json`; event remaps PreToolUse→BeforeTool, PostToolUse→AfterTool, Stop→SessionEnd)
  - instructions → **not** materialized (compile-only); emit non-fatal diagnostic
  - agents → unsupported non-fatal diagnostic
- `configureMcp` → project `.gemini/settings.json` `mcpServers` when `.gemini/` exists (opt-in), Gemini schema (no `type`; `command` / `url` / `httpUrl`), preserve unrelated top-level keys and servers; bake-mode env (default).
- Thin `compile` → project-root `GEMINI.md` containing **instruction** primitives only.
- `deployRoots`: `[".gemini", ".agents", "."]`.
- Docs + object-map note (`targets.gemini: "@bapm/integration-gemini"`); package depends on `@bapm/integration-api` (+ catalog `smol-toml` for command TOML).

**Non-goals:** user-scope (`~/.gemini/…`, `-g`); rich APM distributed compile / `GEMINI.md` stub importing `AGENTS.md`; marketplace mapper; canvas; Antigravity; full APM hook-IR dialect beyond Claude-like merge + Gemini event rename.

## Capabilities

### New Capabilities

- `integration-gemini-runtime`: Gemini CLI project-scope runtime on `@bapm/integration-gemini` — detect, materialize (commands TOML / skills / hooks merge), MCP configure into settings.json, thin instruction-only compile to `GEMINI.md`, package boundary and docs load path.

### Modified Capabilities

- (none) — no requirement changes to existing integration-api / mcp-env-bake / compile-agents-md capabilities; Gemini uses default bake MCP env and host-owned `GEMINI.md` via its own `compile`.

## Impact

- New package: `packages/integration-gemini` (scaffold like claude/codex/copilot).
- Docs: `supported-hosts`, manifest-hosts object-map examples.
- CLI remains empty-registry / object-map load only (`createIntegration` first).
- Tests: unit + acceptance under `tests/acceptance/integration-gemini-runtime/` covering detect, commands TOML, skills, hooks ownership, MCP opt-in, compile instructions-only.
