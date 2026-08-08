## 1. Package scaffold

- [x] 1.1 Create `packages/integration-windsurf` (package.json workspace dep on `@bapm/integration-api` only, vite.config.ts, tsconfig, README) matching other integration-* scaffolding; ensure workspace discovery
- [x] 1.2 Export `createWindsurfIntegration` + `createIntegration` alias from `src/index.ts` with `id: "windsurf"` and `deployRoots: [".windsurf", ".agents"]` (no `mcpEnvMode: "translate"`)

## 2. Detect and materialize

- [x] 2.1 Implement `detect` for `.windsurf/` directory only (no mkdir); forced-target materialize may create `.windsurf` / `.agents`
- [x] 2.2 Materialize instructions → `.windsurf/rules/<name>.md` (preserve `trigger` / `globs` FM when present); assert under deploy roots
- [x] 2.3 Materialize `command` → `.windsurf/workflows/<name>.md`; refuse `.windsurf/commands/`
- [x] 2.4 Materialize skills → `.agents/skills/<name>/` (portable Agent Plugins full directory copy); never `.windsurf/skills/`
- [x] 2.5 Skip `agent` primitives with non-fatal diagnostic (`WINDSURF_AGENTS_UNSUPPORTED` or equivalent); do not write agents trees
- [x] 2.6 Materialize hooks as merge into `.windsurf/hooks.json` + scripts under `.windsurf/hooks/<name>/`; PascalCase events; `.windsurf/bapm-hooks.json` sidecar; idempotent reinstall cleanup

## 3. MCP configure

- [x] 3.1 Implement `configureMcp` → `~/.codeium/windsurf/mcp_config.json` (`CODEIUM_HOME` override) `mcpServers` merge with Copilot-client-adapter JSON parity; preserve unrelated servers; report home `configPath`; never write project MCP or `global_rules`

## 4. Tests and docs

- [x] 4.1 Unit tests: detect, each materialize kind, agents skip diagnostic, hooks sidecar idempotence + PascalCase, MCP home write (temp `CODEIUM_HOME`)
- [x] 4.2 Acceptance suite under `packages/integration-windsurf/tests/acceptance/integration-windsurf-runtime/` covering package boundary, detect, materialize, agents skip, hooks, MCP, no global_rules
- [x] 4.3 Update docs (`supported-hosts`, architecture index, manifest-hosts / object-map notes) for Windsurf opt-in runtime load via `targets: { windsurf: "@bapm/integration-windsurf" }`
- [x] 4.4 Run package/workspace checks (`vp check` / targeted tests) for `@bapm/integration-windsurf`
