# Mcp

Collect MCP server definitions, bake env/header placeholders, and update lock `mcp_*` inventory.

## Public API

- `collectMcpServers` — direct root MCP + optional dependency MCP
- `bakeMcpStringMap` / `bakeMcpServerMaps` — install-time bake of `${VAR}`, `${env:VAR}`, legacy `<VAR>`
- `applyMcpInventoryToLock` — write `mcp_servers` / `mcp_configs` / `mcp_target_servers` / `mcp_config_provenance`

## Collection rules

- Direct `dependencies.mcp` always collected
- Dependency MCP when `--trust-transitive-mcp` **or** grant surface present (sc-009 still gates deploy)

## Bake (Cursor)

Before `configureMcp`, install bakes `env` / `headers` string maps from overrides → `process.env`. Missing required placeholders fail closed (`McpEnvBakeError` / `INSTALL_MCP_ENV_BAKE`). Agent Plugins portable `${PLUGIN_*}` / secret-refuse stays on the AgentPlugins boundary.
