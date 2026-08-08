## 1. API + install bake dispatch

- [x] 1.1 Add optional `mcpEnvMode?: "bake" | "translate"` (or equivalent documented field) on `BapmIntegration` in `@bapm/integration-api`; export/type-check; document default = bake-compatible when omitted
- [x] 1.2 Update install MCP path in `@bapm/core` so APM `${VAR}` / `${env:VAR}` / `<VAR>` bake runs only for bake-mode (or omitted) targets; translate-mode targets receive pass-through placeholders; keep Cursor bake behavior and fail-closed `{bake:NAME}` policy
- [x] 1.3 Adjust/add focused core (or CLI) tests proving Cursor still bakes and a translate-mode double skips bake

## 2. Package scaffold

- [x] 2.1 Create `packages/integration-copilot` (package.json workspace dep on `@bapm/integration-api` only, vite.config.ts, tsconfig, README) matching other integration-* scaffolding; ensure workspace discovery
- [x] 2.2 Export `createCopilotIntegration` + `createIntegration` alias from `src/index.ts` with `id: "copilot"`, `deployRoots: [".github", ".agents"]`, and `mcpEnvMode: "translate"`

## 3. Detect and materialize

- [x] 3.1 Implement whitelist `detect` (any one signal; no mkdir); forced-target materialize may create `.github` / `.agents`
- [x] 3.2 Materialize instructions → `.github/instructions/<name>.instructions.md` (preserve `applyTo` / Copilot FM when present); assert under deploy roots
- [x] 3.3 Materialize `command` / `*.prompt.md` → `.github/prompts/<name>.prompt.md`; refuse `.github/commands/`
- [x] 3.4 Materialize agents → `.github/agents/<name>.agent.md`; skills → `.agents/skills/<name>/` (portable Agent Plugins full directory copy); never `.github/skills/`
- [x] 3.5 Materialize hooks as per-file `.github/hooks/<pkg>-<stem>.json` + scripts under `.github/hooks/scripts/<pkg>/`; camelCase events; `.github/bapm-hooks.json` sidecar for owned paths; idempotent reinstall cleanup

## 4. MCP and compile

- [x] 4.1 Implement `configureMcp` → `~/.copilot/mcp-config.json` (`COPILOT_HOME` override) `mcpServers` merge; translate placeholders to `${VAR}`; preserve unrelated servers; report home `configPath`; never write `.vscode/mcp.json`
- [x] 4.2 Implement thin `compile` → `.github/copilot-instructions.md`; omit instruction primitives already covered by `.github/instructions/` materialize; honor write/validate intent; deterministic order

## 5. Tests and docs

- [x] 5.1 Unit tests: detect matrix, each materialize kind, hooks sidecar idempotence, MCP translate home write (temp `COPILOT_HOME`), compile omit-deployed-instructions / no canvas
- [x] 5.2 Acceptance suite under `packages/integration-copilot/tests/acceptance/integration-copilot-runtime/` covering package boundary, detect, materialize, hooks, MCP, compile
- [x] 5.3 Update docs (`supported-hosts`, architecture index, manifest-hosts / object-map notes) for Copilot opt-in runtime load via `targets: { copilot: "@bapm/integration-copilot" }`
- [x] 5.4 Run package/workspace checks (`vp check` / targeted tests) for `@bapm/integration-copilot`, integration-api, and affected core bake dispatch
