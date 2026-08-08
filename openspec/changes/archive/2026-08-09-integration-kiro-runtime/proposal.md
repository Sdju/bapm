## Why

Kiro is a first-class APM target (`kiro`) with project layout under `.kiro/`, but bapm has no `@bapm/integration-kiro` package. Without it, users cannot opt in via `targets:` object-map, detect Kiro projects, materialize steering/agents/skills/hooks, or configure project MCP with runtime `${VAR}` translate.

## What Changes

- Add greenfield workspace package `@bapm/integration-kiro` implementing `BapmIntegration` (`createKiroIntegration` / `createIntegration`: `detect`, `materialize`, `configureMcp`, thin `compile` → `AGENTS.md`).
- Detect: project `.kiro/` directory (APM `detect_by_dir`; no mkdir / no auto-create).
- Materialize APM Kiro v3 layouts under `.kiro/`:
  - instructions → `.kiro/steering/<name>.md` (`applyTo` → `inclusion: fileMatch` + `fileMatchPattern`; missing → `inclusion: always`)
  - agents → `.kiro/agents/<stem>.md` with frontmatter kept to `description` / `model` / `tools` only (`name` + unknown keys stripped); tools vocabulary fail-closed (no bytes written on unsupported tags)
  - skills → `.kiro/skills/<name>/SKILL.md` (Agent Skills standard; not `.agents/skills/`)
  - hooks → per-file `.kiro/hooks/<pkg>-<stem>-<event>-<n>.json` in **v1** document shape (`version: v1` + `hooks[]` with `trigger` / `action`); scripts under `.kiro/hooks/<pkg>/…`
  - **skip** prompts / commands (APM matrix **N** for kiro)
- `configureMcp` → project `.kiro/settings/mcp.json` `mcpServers` with **translate** placeholders (`${VAR}`), opt-in when `.kiro/` exists (APM `kiro.py` / Copilot-class translate); `mcpEnvMode: "translate"`.
- `deployRoots`: `[".kiro"]` (plus `"."` only if thin `AGENTS.md` compile requires it).
- Docs + object-map load note (`targets.kiro: "@bapm/integration-kiro"`); package depends on `@bapm/integration-api` only.

**Non-goals:** user-scope `~/.kiro/` deploy; prompts/commands materialize; rich / non-v3 hook layouts (`when`/`then` legacy); marketplace mapper; canvas; eager CLI registration.

## Capabilities

### New Capabilities

- `integration-kiro-runtime`: Kiro IDE/CLI v3 project-scope runtime on `@bapm/integration-kiro` — `.kiro/` detect, steering/agents/skills/hooks materialize (incl. agent tools fail-closed), project MCP translate configure, thin `AGENTS.md` compile, package boundary and docs load path.

### Modified Capabilities

- `compile-agents-md`: When the active compile target is Kiro and the integration exposes `compile`, allow host-owned `AGENTS.md` emission (agents-family), not a cursor-default foreign side effect.

## Impact

- New package: `packages/integration-kiro` (scaffold like copilot/claude).
- Docs: `supported-hosts`, architecture index, manifest-hosts object-map examples.
- CLI remains empty-registry / object-map load only (`createIntegration` first).
- Reuses existing `mcpEnvMode: "translate"` from `integration-api-contracts` / install bake skip (no new bake-mode API).
- Tests: unit + `packages/integration-kiro/tests/acceptance/integration-kiro-runtime/` covering detect, steering, agents FM+fail-closed, skills, v1 hooks, MCP translate, compile omit-deployed-steering.
