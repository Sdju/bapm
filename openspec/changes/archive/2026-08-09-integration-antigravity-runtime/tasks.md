## 1. Package scaffold

- [x] 1.1 Create `packages/integration-antigravity` (package.json, tsconfig, vite.config, README) mirroring sibling integration packages; depend on `@bapm/integration-api` only
- [x] 1.2 Export `createAntigravityIntegration` and `createIntegration` from `src/index.ts` with `id: "antigravity"` and deployRoots `[".agents", "."]`

## 2. Runtime behavior

- [x] 2.1 Implement `detect` always `false` (no mkdir, ignore `.agents/` presence)
- [x] 2.2 Materialize instructions → `.agents/rules/<name>.md` with `trigger`/`globs` from `applyTo`
- [x] 2.3 Materialize skills → `.agents/skills/<name>/SKILL.md` (portable skill directory copy)
- [x] 2.4 Materialize hooks → merge `.agents/hooks.json` (agy nested/flat schema, seconds timeout) + scripts + `.agents/bapm-hooks.json` sidecar; preserve unrelated hook-name containers
- [x] 2.5 Skip agents/commands with non-fatal diagnostics
- [x] 2.6 `configureMcp` → `.agents/mcp_config.json` opt-in when `.agents/` exists; `serverUrl` for remote; no `~/.gemini/`
- [x] 2.7 Thin `compile` → `AGENTS.md` omitting instruction primitives

## 3. Docs and wiring

- [x] 3.1 Document object-map load and explicit-only activation on supported-hosts / architecture docs
- [x] 3.2 Note overlap caution with agent-skills (only rules/skills/hooks/mcp under `.agents/`)

## 4. Tests

- [x] 4.1 Unit tests: detect false, rules FM, skills, hooks schema+sidecar, MCP opt-in/skip/`serverUrl`, compile omit, agents/commands skip, package boundary
- [x] 4.2 Acceptance suite under package `tests/acceptance/integration-antigravity-runtime/` covering the OpenSpec scenarios (RED then GREEN)
