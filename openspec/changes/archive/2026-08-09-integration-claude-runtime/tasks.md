## 1. Package surface

- [x] 1.1 Add `createClaudeIntegration` / `createIntegration` factory module in `packages/integration-claude` while keeping `mapClaudeMarketplace` / `claudeMarketplaceIntegration` exports
- [x] 1.2 Update package description/README exports so runtime + marketplace dual surface is documented; `vp pack` / `vp check` for the package succeed

## 2. Detect, roots, materialize primitives

- [x] 2.1 Implement `detect` for `.claude/` directory or project-root `CLAUDE.md` without creating those paths
- [x] 2.2 Register default `deployRoots` as `.claude` and `.` per design; assert materialize writes stay under `.claude/`
- [x] 2.3 Materialize skills to `.claude/skills/<name>/` (including portable Agent Plugins directory copy); never `.agents/skills/`
- [x] 2.4 Materialize instructions to `.claude/rules/<name>.md` with `applyTo` → `paths:` transform (omit `paths` when unconditional)
- [x] 2.5 Materialize agents to `.claude/agents/<name>.md` and commands to `.claude/commands/<name>.md` with shared frontmatter subset + drop diagnostics

## 3. Hooks and MCP

- [x] 3.1 Merge hooks into `.claude/settings.json`, copy scripts under `.claude/hooks/`, and maintain `.claude/bapm-hooks.json` ownership sidecar for idempotent replace of owned entries
- [x] 3.2 Implement `configureMcp` → project `.mcp.json` `mcpServers` with Claude stdio normalization, shallow merge, `.agents/skills/` → `.claude/skills/` command rewrite
- [x] 3.3 Skip project MCP writes with diagnostic when `.claude/` is absent; never write user-scope / `projects.*` local MCP

## 4. Compile

- [x] 4.1 Implement `compile` defaulting to `CLAUDE.md`, omitting instruction primitives from the body, honoring write/preview intent and deterministic ordering

## 5. Tests and docs

- [x] 5.1 Unit tests for detect, each materialize kind, hooks sidecar idempotence, MCP opt-in/skip/rewrite, compile omit-instructions / no-write
- [x] 5.2 Keep marketplace mapper tests green; add/adjust any core/cli shim expectations if dual exports require it
- [x] 5.3 Update user docs (`supported-hosts`, architecture index, marketplace-pack situations) so Claude is opt-in runtime + marketplace, not marketplace-only
- [x] 5.4 Run package/workspace checks (`vp check` / targeted tests) for `@b-apm/integration-claude` and affected docs/tests
