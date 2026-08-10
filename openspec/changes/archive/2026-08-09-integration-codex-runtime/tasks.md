## 1. Package surface

- [x] 1.1 Add `createCodexIntegration` / `createIntegration` factory module in `packages/integration-codex` while keeping `mapCodexMarketplace` / `codexMarketplaceIntegration` exports
- [x] 1.2 Add TOML parse/serialize dependency via pnpm catalog only; update package description/README so runtime + marketplace dual surface is documented; `vp pack` / `vp check` for the package succeed

## 2. Detect, roots, materialize primitives

- [x] 2.1 Implement `detect` for project-root `.codex/` directory only (false for lone `AGENTS.md` / empty project) without creating paths
- [x] 2.2 Register default `deployRoots` as `.codex`, `.agents`, and `.` per design; assert materialize writes stay under `.codex/` or `.agents/`; harden root compile basename allowlist for `AGENTS.md`
- [x] 2.3 Materialize skills to `.agents/skills/<name>/` (including portable Agent Plugins directory copy); never `.codex/skills/`
- [x] 2.4 Materialize agents to `.codex/agents/<name>.toml` (FM `name`/`description` + body → `developer_instructions`); drop `tools` (+ other unsupported FM) with diagnostics
- [x] 2.5 Skip instruction/command/prompt native writes with non-fatal diagnostics; install stays successful

## 3. Hooks and MCP

- [x] 3.1 Merge hooks into `.codex/hooks.json`, copy scripts under `.codex/hooks/<name>/`, and maintain `.codex/bapm-hooks.json` ownership sidecar for idempotent replace of owned entries
- [x] 3.2 On active Codex invocation (incl. forced `--target`), mkdir `.codex/` as needed for hooks and MCP (unified create policy); detect remains non-creating
- [x] 3.3 Implement `configureMcp` → `.codex/config.toml` `mcp_servers` (TOML merge); allow stdio + https remote; reject SSE with diagnostic; skip+diag on unparseable TOML (no clobber); no user-scope paths

## 4. Compile

- [x] 4.1 Implement `compile` defaulting to `AGENTS.md`, **including** instruction primitives, honoring write/preview intent and deterministic ordering; document last-writer collision with Cursor (no merge)

## 5. Tests and docs

- [x] 5.1 Unit tests for detect, each materialize kind (skill/agent/skip), hooks sidecar idempotence, MCP write/SSE/malformed skip, compile include-instructions / no-write
- [x] 5.2 Keep marketplace mapper tests green; add/adjust any core/cli shim expectations if dual exports require it
- [x] 5.3 Update user docs (`supported-hosts`, architecture index, marketplace-pack situations, compile notes) so Codex is opt-in runtime + marketplace, not marketplace-only; note shared `AGENTS.md` last-writer policy
- [x] 5.4 Run package/workspace checks (`vp check` / targeted tests) for `@b-apm/integration-codex` and affected docs/tests
