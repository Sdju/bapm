# Mcp

Collect MCP server definitions and update lock `mcp_*` inventory.

## Public API

- `collectMcpServers` — direct root MCP + optional dependency MCP
- `applyMcpInventoryToLock` — write `mcp_servers` / `mcp_configs` / `mcp_target_servers` / `mcp_config_provenance`

## Collection rules

- Direct `dependencies.mcp` always collected
- Dependency MCP when `--trust-transitive-mcp` **or** grant surface present (sc-009 still gates deploy)
