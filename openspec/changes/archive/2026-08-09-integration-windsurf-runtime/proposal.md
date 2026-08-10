## Why

Windsurf/Cascade is a first-class APM target (`KNOWN_TARGETS["windsurf"]`) with project layouts under `.windsurf/` and `.agents/skills/`, but bapm has no `@b-apm/integration-windsurf` package. Without it, users cannot opt in via `targets:` object-map, detect Windsurf projects, materialize rules/workflows/skills/hooks, or configure Windsurf home MCP.

## What Changes

- Add greenfield workspace package `@b-apm/integration-windsurf` implementing `BapmIntegration` (`createWindsurfIntegration` / `createIntegration`: `detect`, `materialize`, `configureMcp`).
- Detect using APM project signal: directory `.windsurf/` (`detect_by_dir=True`, `auto_create=False`).
- Materialize project-scope layouts aligned with APM Windsurf:
  - instructions → `.windsurf/rules/<name>.md`
  - commands → `.windsurf/workflows/<name>.md`
  - skills → `.agents/skills/<name>/SKILL.md`
  - hooks → merge `.windsurf/hooks.json` + script copy under `.windsurf/hooks/` + ownership sidecar
  - agents → **skip** (APM N; Cascade uses skills auto-invoke; emit diagnostic, do not write agents trees)
- `configureMcp` → home `~/.codeium/windsurf/mcp_config.json` `mcpServers` with Copilot-client-adapter parity (JSON shape); install-time bake (default `mcpEnvMode`, not translate — APM Windsurf pins `_supports_runtime_env_substitution=False`).
- `deployRoots`: `[".windsurf", ".agents"]`.
- Docs + CLI object-map load note (`targets.windsurf: "@b-apm/integration-windsurf"`); package depends on `@b-apm/integration-api` only.

**Non-goals:** user-scope deploy under `~/.codeium/windsurf/` (including `memories/global_rules.md`); agents materialize; marketplace mapper; thin/rich `compile` / `AGENTS.md` emitter; project-scoped MCP; full APM hook-IR dialect beyond Cursor/Claude merge reuse.

## Capabilities

### New Capabilities

- `integration-windsurf-runtime`: Windsurf project-scope runtime on `@b-apm/integration-windsurf` — `.windsurf/` detect, materialize paths (rules/workflows/skills/hooks), skip agents, home MCP bake configure via client-adapter parity, package boundary and docs load path.

### Modified Capabilities

- (none) — bake is the default install path; no `mcpEnvMode` / compile contract changes required for this host.

## Impact

- New package: `packages/integration-windsurf` (scaffold like cursor/copilot/claude).
- Docs: `supported-hosts`, architecture index, manifest-hosts object-map examples.
- CLI remains empty-registry / object-map load only (`createIntegration` first).
- Tests: unit + acceptance under `packages/integration-windsurf/tests/acceptance/integration-windsurf-runtime/`.
