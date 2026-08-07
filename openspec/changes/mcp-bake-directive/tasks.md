## 1. Bake directive

- [ ] 1.1 Extend `bake.ts` to resolve `{bake:NAME}` and `{bake:env:NAME}` with the same overrides → env lookup and `McpEnvBakeError` fail-closed
- [ ] 1.2 Unit tests in `packages/core/tests/mcp/` for success, `{bake:env:…}`, missing var, and coexistence with `${VAR}`
- [ ] 1.3 Confirm install path needs no extra wire (existing `bakeMcpServerMaps`); add/adjust CLI mcp bake test if needed for `{bake:…}` → literal in `.cursor/mcp.json`

## 2. Docs and verify

- [ ] 2.1 Document `{bake:NAME}` as bapm-only extension in `apps/docs/guide/config-manifest.md` (alongside APM forms)
- [ ] 2.2 Run focused mcp bake tests; mark tasks done
