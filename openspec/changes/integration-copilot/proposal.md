## Why

GitHub Copilot is a first-class APM target (`copilot`) with project file conventions under `.github/` / `.agents/`, but bapm has no `@bapm/integration-copilot` package. Without it, users cannot opt in via `targets:` object-map, detect Copilot projects, materialize instructions/prompts/agents/skills/hooks, configure Copilot CLI MCP, or thin-compile `.github/copilot-instructions.md`.

## What Changes

- Add greenfield workspace package `@bapm/integration-copilot` implementing `BapmIntegration` (`createCopilotIntegration` / `createIntegration`: `detect`, `materialize`, `configureMcp`, thin `compile`).
- Detect using APM `SIGNAL_WHITELIST` (any one): `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/`, `.github/prompts/`, `.github/hooks/`.
- Materialize project-scope layouts aligned with APM Copilot:
  - instructions → `.github/instructions/<name>.instructions.md` (preserve Copilot FM / `applyTo` when present)
  - bapm `command` / `*.prompt.md` → `.github/prompts/<name>.prompt.md` (**prompts-native**; never `.github/commands/`)
  - agents → `.github/agents/<name>.agent.md`
  - skills → `.agents/skills/<name>/SKILL.md`
  - hooks → per-file `.github/hooks/<pkg>-<stem>.json` + scripts; camelCase events; documented ownership
- `configureMcp` → home `~/.copilot/mcp-config.json` `mcpServers` with **translate** placeholders (`${VAR}`), parity with APM Copilot CLI (documented home-scope exception vs project MCP hosts).
- Thin `compile` → `.github/copilot-instructions.md`, omitting instruction primitives already deployed under `.github/instructions/`.
- `deployRoots`: at least `[".github", ".agents"]` (plus `"."` only if compile/helpers require it — decided in design).
- Docs + CLI object-map load note (`targets.copilot: "@bapm/integration-copilot"`); package depends on `@bapm/integration-api` only.
- Install/core MCP bake path: skip bake for translate-mode hosts so Copilot does not receive Cursor-style literals.

**Non-goals:** canvas / `.github/extensions/`; user-scope file deploy (`~/.copilot/prompts`, concat user instructions, `-g` `AGENTS.md`); vscode project MCP (`.vscode/mcp.json`); marketplace mapper; rich APM compile / `apm run` Copilot runtime; cowork/app experimental targets; full hook-IR dialect beyond existing Cursor/Claude reuse.

## Capabilities

### New Capabilities

- `integration-copilot-runtime`: GitHub Copilot project-scope runtime on `@bapm/integration-copilot` — whitelist detect, materialize paths (incl. prompts-native commands), per-file hooks + ownership, home MCP translate configure, thin compile to `copilot-instructions.md`, package boundary and docs load path.

### Modified Capabilities

- `mcp-env-bake`: Allow hosts that declare translate-mode MCP env policy to skip install-time bake of `${VAR}` / `${env:VAR}` / `<VAR>` so configure writes host runtime placeholders (Copilot), without weakening Cursor bake-only requirements.
- `integration-api-contracts`: Optional integration-declared MCP env policy (bake vs translate) so core/install can dispatch without hardcoding host ids.
- `compile-agents-md`: When the active compile target is Copilot and the integration exposes `compile`, allow host-owned `.github/copilot-instructions.md` emission (not a cursor-default foreign side effect).

## Impact

- New package: `packages/integration-copilot` (scaffold like cursor/claude/codex/opencode).
- Likely small updates: `@bapm/integration-api` (optional `mcpEnvMode`), `@bapm/core` install MCP bake dispatch, docs (`supported-hosts`, architecture index, manifest-hosts object-map examples).
- CLI remains empty-registry / object-map load only (`createIntegration` first).
- Tests: unit + `packages/integration-copilot/tests/acceptance/integration-copilot/` (or `…-runtime/`) covering detect, materialize kinds, hooks ownership, MCP translate home write, compile omit-deployed-instructions.
