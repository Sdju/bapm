# ExecutableInventory

> **UNSTABLE:** Read-only inspection helpers for `bapm approve --list/--pending`.

## Public API

- `listUserExecutableGrants` — user-local `executables.allow`/`executables.deny`
  rows from `<configRoot>/config.json` (`~/.bapm` by default), with package,
  grant, types, and source. Never writes.
- `listPendingExecutablePackages` — dependency packages with executable types
  (`mcp`, `lsp`, `bin`, `hook`) that have no explicit allow/deny decision in the
  project manifest, user config, or org policy. Never writes.

## Sources

- MCP packages: `Mcp.listMcpInventory` (`mcp_servers` lock inventory).
- `bin`: `Install.discoverPackageBinFiles` over materialized lock package roots.
- `hook`: `Primitives.discoverPrimitives` over the same roots.
- Trust decisions: `ExecutableTrust.resolveExecutableTrust` (deny-wins ladder).
- Org deny: `Policy.runPolicyGate` → `executables.deny` / `deny_all`.

A package only appears when at least one of its executable types is neither
allowed nor denied. Root-owned/direct MCP servers are excluded: they are not
dependency executables and need no grant.
