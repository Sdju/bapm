## ADDED Requirements

### Requirement: Lock rewrite carries forward inventory top-level bags

When `resolveAndLock` rebuilds and writes a lockfile from a resolve graph, it MUST copy forward from the previously loaded lock document any present top-level inventory bags that the lock-only path does not reconcile from disk, including at least `mcp_servers`, `mcp_configs`, `mcp_target_servers`, and `mcp_config_provenance`, and when present also `lsp_*`, `deployments`, and other unknown / `x-*` top-level keys already retained by serialize. Carry-forward MUST preserve recorded shapes opaquely (no reshape of `mcp_servers` map vs list). Lock-only rewrite MUST NOT invent MCP inventory from harness disk when those bags are absent. Per-dependency `deployed_file_hashes` and top-level `local_deployed_file_hashes` carry-forward MUST remain. OpenAPM `tree_sha256` computation on git entries (lk-015) MUST NOT be weakened.

#### Scenario: mcp_* bags survive bare lock rewrite

- **WHEN** an existing lockfile contains `mcp_servers` (and related `mcp_*` fields) written by a prior install, and `resolveAndLock` / bare `lock` rewrites the lock successfully
- **THEN** the new lockfile MUST still contain those `mcp_*` fields with equivalent recorded content

#### Scenario: Absent MCP is not invented on lock-only

- **WHEN** the existing lock has no `mcp_*` bags and lock rewrite runs without an MCP integrator
- **THEN** the written lock MUST NOT be required to invent empty `mcp_*` placeholders from disk

#### Scenario: deployed hashes still carried

- **WHEN** existing dependencies have `deployed_file_hashes` and lock rewrite keeps those identities
- **THEN** the rewritten entries MUST retain those hash maps

#### Scenario: tree_sha256 still computed for git pins

- **WHEN** `resolveAndLock` writes a git dependency after download
- **THEN** the emitted entry MUST include a computed `tree_sha256` envelope (lk-015)
