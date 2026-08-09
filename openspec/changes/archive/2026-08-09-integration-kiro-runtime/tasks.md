## 1. Package scaffold

- [x] 1.1 Create `packages/integration-kiro` (`package.json`, `vite.config.ts`, `tsconfig.json`, `README.md`) mirroring `@bapm/integration-copilot` with dep `@bapm/integration-api` only
- [x] 1.2 Export `createKiroIntegration` / `createIntegration` from `src/index.ts`; wire workspace install (`vp` / pnpm) so the package resolves

## 2. Runtime implementation

- [x] 2.1 Implement `detect` for `.kiro/` directory; set `id: "kiro"`, `deployRoots: [".kiro", "."]`, `mcpEnvMode: "translate"`
- [x] 2.2 Materialize skills → `.kiro/skills/<name>/` via `materializeSkill`
- [x] 2.3 Materialize instructions → `.kiro/steering/<name>.md` with `applyTo` → fileMatch / default always
- [x] 2.4 Materialize agents → `.kiro/agents/<stem>.md` with FM strip + `KIRO_AGENT_ALLOWED_TOOLS` fail-closed diagnostics
- [x] 2.5 Skip command/prompt primitives (no `.kiro/` writes)
- [x] 2.6 Materialize hooks → per-file `.kiro/hooks/*` v1 JSON + scripts + ownership sidecar
- [x] 2.7 Implement `configureMcp` → `.kiro/settings/mcp.json` with translate placeholders and opt-in skip when `.kiro/` absent
- [x] 2.8 Implement thin `compile` → `AGENTS.md` omitting instruction primitives

## 3. Docs

- [x] 3.1 Document Kiro on `apps/docs/guide/supported-hosts.md` and architecture index / manifest-hosts examples

## 4. Verification

- [x] 4.1 Acceptance suite under `packages/integration-kiro/tests/acceptance/integration-kiro-runtime/` (RED then GREEN)
- [x] 4.2 Package unit tests + `vp check` / `vp test` for the package
