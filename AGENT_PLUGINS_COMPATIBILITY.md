# bapm Agent Plugins v1 compatibility

This is bapm's portable Agent Plugins v1 support matrix, not an Agent Plugins certification or universal client-conformance claim.

## Support matrix
| Component | Status | Boundary | Evidence |
| --- | --- | --- | --- |
| `manifest` | supported | Canonical root plugin.json is validated and can be produced. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/compatibility-status.test.ts) |
| `skills` | supported | Immediate skills/<name>/ directories with SKILL.md are discovered and copied as complete safe directories. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/compatibility-status.test.ts) |
| `mcp` | supported | Root mcp.json supports stdio, streamable HTTP, and SSE after portable validation. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/compatibility-status.test.ts) |
| `commands` | supported | Declared plugin.json commands path entries are required, fail-closed on missing/escape, and materialize through the active host matrix. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/commands-hooks.test.ts) |
| `hooks` | target-specific | Declared plugin.json hooks path entries fail-closed on missing/escape; Cursor merges into .cursor/hooks.json, OpenCode skips with an inspectable diagnostic. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/commands-hooks.test.ts) |
| `unsafe-input` | rejected | Escaping skill paths and reserved or secret-like MCP environment entries are withheld. | [fixture](tests/fixtures/agent-plugins/v1-unsafe) · [test](packages/core/tests/agent-plugins/compatibility-status.test.ts) |
| `cursor-mcp` | target-specific | Cursor maps portable stdio to stdio, streamable-http to http, and SSE to sse in .cursor/mcp.json. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/consumer.test.ts) |
| `opencode-mcp` | target-specific | OpenCode maps portable stdio to local and streamable-http to remote under opencode.json mcp; SSE is fail-closed. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/opencode-install-e2e.test.ts) |
| `unsupported-components` | not-supported | Undeclared agents, client extensions, OAuth/secrets, sandboxing, and vendor-specific extension behavior are not implemented. | [fixture](tests/fixtures/agent-plugins/v1-portable) · [test](packages/core/tests/agent-plugins/compatibility-status.test.ts) |

## Target behavior
Portable MCP is an input contract, not a host configuration format. The Cursor target maps supported transports into `.cursor/mcp.json`: `stdio` → `stdio`, `streamable-http` → `http`, and `sse` → `sse`. The OpenCode target (`@bapm/integration-opencode`) maps portable `stdio` → OpenCode `local` and `streamable-http` → `remote` under project `opencode.json` `mcp`; portable `sse` is fail-closed. Other targets must explicitly implement their own adapter; absence of one is not a portable-plugin failure.

## Product boundary
Portable Agent Plugins are separate from bapm/OpenAPM manifests, lockfiles, producer claims, and the bapm marketplace. `plugin.json` is not `bapm.yml` or `apm.yml`; portable archive production does not publish to, resolve through, or imply support by a marketplace.

## Non-goals
This boundary does not provide sandboxing, OAuth or secret injection, client extensions, undeclared agents, or vendor-specific extension behavior. Declared `commands` / `hooks` paths in `plugin.json` are in-boundary (see matrix). Unknown manifest fields are diagnostic-only for forward compatibility; they are not an implementation claim. See [CONFORMANCE.md](CONFORMANCE.md) only for bapm's separate OpenAPM claims.

## Verification
```bash
pnpm run agent-plugins:check
vp test packages/core/tests/agent-plugins/compatibility-status.test.ts
vp test packages/core/tests/agent-plugins/consumer.test.ts
```
