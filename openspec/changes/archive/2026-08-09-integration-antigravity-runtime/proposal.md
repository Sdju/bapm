## Why

Google Antigravity CLI (`agy`) is a first-class APM target (`antigravity`, alias `agy`) with project layouts under the shared `.agents/` root, but bapm has no `@b-apm/integration-antigravity` package. Without it, users cannot opt in via the manifest object-map / `--target antigravity`, materialize rules/skills/hooks, configure project MCP, or thin-compile `AGENTS.md` with rules dedup.

## What Changes

- Add greenfield workspace package `@b-apm/integration-antigravity` implementing `BapmIntegration` (`createAntigravityIntegration` / `createIntegration`: `detect`, `materialize`, `configureMcp`, thin `compile`).
- **Explicit-only detect:** `detect` MUST always return false (shared `.agents/` is not an Antigravity-unique signal). Activation only via forced `--target antigravity` / object-map / explicit target selection. MUST NOT participate in `--target all` auto-expansion alone (document + test; core `all` already excludes it when selection follows APM).
- Materialize project-scope layouts aligned with APM Antigravity:
  - instructions → `.agents/rules/<name>.md` with `trigger` / `globs` frontmatter mapped from `applyTo`
  - skills → `.agents/skills/<name>/SKILL.md`
  - hooks → merge `.agents/hooks.json` in **agy native schema** (nested PreToolUse/PostToolUse/… vs flat Stop/…) + script tree + ownership sidecar
  - agents / commands → **skip** (APM N; non-fatal diagnostics)
- `configureMcp` → project `.agents/mcp_config.json` (`mcpServers`), **opt-in** only when `.agents/` already exists; remote URLs as `serverUrl` when required by agy schema
- Thin `compile` → project `AGENTS.md`, omitting instruction primitives already deployed under `.agents/rules/`
- `deployRoots`: at least `[".agents"]` (plus `"."` only if compile containment requires it — decided in design)
- Docs + CLI object-map load note (`targets.antigravity: "@b-apm/integration-antigravity"`); package depends on `@b-apm/integration-api` only

**Non-goals:** auto-detect from `.agents/`; user-scope `~/.gemini/**` (skills, MCP, hooks, rules); agents/commands native writers; GEMINI.md compile family; marketplace mapper; rich APM distributed compile; claiming unrelated `.agents/` subtrees beyond rules/skills/hooks/mcp (overlap caution with agent-skills).

## Capabilities

### New Capabilities

- `integration-antigravity-runtime`: Antigravity CLI project-scope runtime on `@b-apm/integration-antigravity` — explicit-only detect, materialize rules/skills/hooks under `.agents/`, opt-in project MCP `mcp_config.json`, thin `AGENTS.md` compile omitting deployed rules, package boundary and docs load path.

### Modified Capabilities

- `compile-agents-md`: When the active compile target is Antigravity and the integration exposes `compile`, allow host-owned project-root `AGENTS.md` emission (shared family with Cursor/Codex) with rules-dedup omit semantics; keep cursor-default “no foreign-host side effects” intent.

## Impact

- New package: `packages/integration-antigravity` (scaffold like cursor/claude/codex/opencode/copilot).
- Docs: `supported-hosts`, architecture index, object-map examples.
- CLI remains empty-registry / object-map load only.
- Tests: unit + acceptance covering explicit-only detect, rules FM, skills, hooks schema + sidecar, MCP opt-in + `serverUrl`, compile omit-deployed-rules, skip agents/commands.
