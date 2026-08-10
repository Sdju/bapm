## 1. Package scaffold

- [x] 1.1 Create `packages/integration-gemini` with vite-plus `package.json`, `tsconfig.json`, `vite.config.ts`, README (detect/materialize/MCP/compile + object-map example)
- [x] 1.2 Wire workspace dependency on `@b-apm/integration-api` and catalog `smol-toml` via pnpm CLI; export `createGeminiIntegration` / `createIntegration`

## 2. Runtime implementation

- [x] 2.1 Implement detect (`.gemini/` | `GEMINI.md`), default deployRoots, `getDeployRoots`
- [x] 2.2 Materialize: skills → `.agents/skills/`, commands → `.gemini/commands/*.toml`, instruction/agent diagnostics, hooks merge + ownership sidecar
- [x] 2.3 `configureMcp` → `.gemini/settings.json` `mcpServers` (Gemini schema, opt-in skip)
- [x] 2.4 Thin `compile` → `GEMINI.md` (instructions only)

## 3. Docs

- [x] 3.1 Document Gemini on `apps/docs/guide/supported-hosts.md` (+ brief object-map note in `manifest-hosts.md` if needed)

## 4. Tests

- [x] 4.1 Acceptance suite under `tests/acceptance/integration-gemini-runtime/` (RED then GREEN): package boundary, detect, commands TOML, skills, hooks ownership, MCP, compile
- [x] 4.2 Promote acceptance into package unit tests; ensure `@b-apm/core` does not depend on gemini
