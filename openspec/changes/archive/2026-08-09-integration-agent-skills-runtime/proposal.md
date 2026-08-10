## Why

APM ships a canonical `agent-skills` target: cross-client shared skills under `.agents/skills/` that is never auto-detected and only activates via explicit `--target` / manifest. bapm already accepts `agent-skills` as an mf-005 token, but has no `@b-apm/integration-agent-skills` package, so authors cannot opt in via object-map `targets` and materialize skills-only bundles without also activating a full host (Cursor/Codex/Copilot).

## What Changes

- Add greenfield workspace package `@b-apm/integration-agent-skills` implementing a thin `BapmIntegration` (`createAgentSkillsIntegration` / `createIntegration`: `detect`, `materialize` only).
- `detect` always returns false — never auto-detect from `.agents/` (shared by Codex/Copilot/Cursor/antigravity). Activation only via explicit manifest `targets` object-map + `active` and/or forced `--target agent-skills`.
- Materialize skills only → `.agents/skills/<name>/SKILL.md` (portable Agent Plugins skill dirs fully copied), using the same `materializeSkill` helper pattern as Cursor/Codex/Copilot.
- Non-skill primitives (instruction, agent, command, prompt, hook, unknown) MUST NOT write host files; install stays non-fatal with clear diagnostics.
- No `configureMcp`, no hooks ownership, no `compile` — compile against this id is out of scope / no-op at the integration boundary (integration does not expose `compile`).
- `deployRoots`: `[".agents"]`.
- Docs + object-map load note (`targets.agent-skills: "@b-apm/integration-agent-skills"`); package depends on `@b-apm/integration-api` only.
- Overlap with antigravity (and other hosts that also write `.agents/skills/`) is intentional and OK — shared skills path.

**Non-goals:** MCP config; hooks; compile/`AGENTS.md` emission; user-scope (`~/.agents/skills/`) in this change; antigravity package; marketplace mapper; auto-detect from `.agents/`; including `agent-skills` in any implicit `all`/detect fan-out inside this package.

## Capabilities

### New Capabilities

- `integration-agent-skills-runtime`: Explicit-only agent-skills host on `@b-apm/integration-agent-skills` — never-detect policy, skills-only materialize to `.agents/skills/`, skip non-skill primitives, thin package boundary and docs load path.

### Modified Capabilities

- (none) — existing `manifest-active-targets` / `target-integration-dynamic-load` already cover explicit activation and object-map registration; this change adds a concrete host package only.

## Impact

- New package: `packages/integration-agent-skills` (scaffold like cursor/codex/copilot, skills-only subset).
- Docs: `supported-hosts` (+ architecture index / manifest object-map examples if present).
- CLI remains empty-registry / object-map load only (`createIntegration` first).
- Tests: unit + acceptance under `packages/integration-agent-skills/tests/` covering never-detect, skills materialize, non-skill skips, forced/active activation path.
