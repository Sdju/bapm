## 1. Package scaffold

- [ ] 1.1 Create `packages/integration-gemini` with vite-plus `package.json`, `tsconfig.json`, `vite.config.ts`, README (detect/materialize/MCP/compile + object-map example)
- [ ] 1.2 Wire workspace dependency on `@bapm/integration-api` and catalog `smol-toml` via pnpm CLI; export `createGeminiIntegration` / `createIntegration`

## 2. Runtime implementation

- [ ] 2.1 Implement detect (`.gemini/` | `GEMINI.md`), default deployRoots, `getDeployRoots`
- [ ] 2.2 Materialize: skills → `.agents/skills/`, commands → `.gemini/commands/*.toml`, instruction/agent diagnostics, hooks merge + ownership sidecar
- [ ] 2.3 `configureMcp` → `.gemini/settings.json` `mcpServers` (Gemini schema, opt-in skip)
- [ ] 2.4 Thin `compile` → `GEMINI.md` (instructions only)

## 3. Docs

- [ ] 3.1 Document Gemini on `apps/docs/guide/supported-hosts.md` (+ brief object-map note in `manifest-hosts.md` if needed)

## 4. Tests

- [ ] 4.1 Acceptance suite under `tests/acceptance/integration-gemini-runtime/` (RED then GREEN): package boundary, detect, commands TOML, skills, hooks ownership, MCP, compile
- [ ] 4.2 Promote acceptance into package unit tests; ensure `@bapm/core` does not depend on gemini
