## 1. Core bake helper

- [x] 1.1 Add `@bapm/core` bake-time resolver for MCP string maps (`env` / `headers`): `${VAR}`, `${env:VAR}`, legacy `<VAR>`; overrides then `process.env`; fail closed naming missing keys (no secret literals in errors)
- [x] 1.2 Export resolver from Mcp (or Install) public surface used by install; unit-test success + missing-var + multi-placeholder + passthrough literals
- [x] 1.3 Confirm Agent Plugins `${PLUGIN_*}` / secret-refuse path is untouched (existing tests still pass)

## 2. Wire into Cursor MCP deploy

- [x] 2.1 Bake approved MCP servers in install before `configureMcp` (core owns bake; integration receives baked maps)
- [x] 2.2 Ensure unresolved placeholders abort before durable `.cursor/mcp.json` write
- [x] 2.3 Integration/CLI test: install `--target cursor` with `${API_TOKEN}` → mcp.json literal; missing var → non-zero / no placeholder write

## 3. Docs and verify

- [x] 3.1 Document Cursor bake + supported placeholder syntaxes in `apps/docs` (config-manifest and/or MCP situation)
- [x] 3.2 Run focused core + integration-cursor / cli mcp tests; fix regressions
