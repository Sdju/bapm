## 1. Package scaffold

- [x] 1.1 Create `packages/integration-grok-build` (package.json workspace dep on `@bapm/integration-api` only, vite.config.ts, tsconfig, README) matching other integration-* scaffolding; ensure workspace discovery
- [x] 1.2 Export `createGrokBuildIntegration` + `createIntegration` alias from `src/index.ts` with `id: "grok-build"`, `deployRoots: [".grok", "."]`, and no `configureMcp`

## 2. Detect, materialize, compile

- [x] 2.1 Implement detect: `.grok/` directory only (no mkdir; lone `AGENTS.md` is not a signal)
- [x] 2.2 Materialize skills → `.grok/skills/<name>/` (portable Agent Plugins full directory copy); never `.agents/skills/`
- [x] 2.3 Materialize instructions → `.grok/rules/<name>.md` (verbatim); agents → `.grok/agents/<name>.md`; commands → `.grok/commands/<name>.md` with Claude-subset frontmatter + drop diagnostic
- [x] 2.4 Skip hooks and prompts with non-fatal diagnostics; assert writes under deploy roots; forced materialize may mkdir `.grok`
- [x] 2.5 Implement thin `compile` → project-root `AGENTS.md`; honor write/validate intent; deterministic order; basename allowlist

## 3. Tests and docs

- [x] 3.1 Unit tests: detect matrix, each materialize kind, hooks/prompts skip, compile write/preview, package boundary (no configureMcp / no core dep)
- [x] 3.2 Acceptance suite under `packages/integration-grok-build/tests/acceptance/integration-grok-build-runtime/` covering the same behaviors
- [x] 3.3 Update docs (`supported-hosts`, architecture index) for Grok Build opt-in runtime load via `targets: { grok-build: "@bapm/integration-grok-build" }`
- [x] 3.4 Run package checks (`vp check` / targeted tests) for `@bapm/integration-grok-build`
