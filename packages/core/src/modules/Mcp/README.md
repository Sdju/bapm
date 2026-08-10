# Mcp

> **UNSTABLE:** Early public release. APIs and on-disk layouts may change without a major bump. Not production-ready.

Collect MCP server definitions, bake env/header placeholders, and update lock `mcp_*` inventory.

## Public API

- `collectMcpServers` — direct root MCP + optional dependency MCP
- `bakeMcpStringMap` / `bakeMcpServerMaps` — install-time bake of `${VAR}`, `${env:VAR}`, legacy `<VAR>`, and bapm `{bake:NAME}` / `{bake:env:NAME}`; `mode: "translate"` leaves APM placeholders untouched while still resolving `{bake:…}` (per-target via `BapmIntegration.mcpEnvMode`)
- `applyMcpInventoryToLock` — write `mcp_servers` / `mcp_configs` / `mcp_target_servers` / `mcp_config_provenance`

## Collection rules

- Direct `dependencies.mcp` always collected
- Dependency MCP when `--trust-transitive-mcp` **or** grant surface present (sc-009 still gates deploy)

## Bake (Cursor)

Before `configureMcp`, install bakes `env` / `headers` string maps from overrides → `process.env`. Missing required placeholders fail closed (`McpEnvBakeError` / `INSTALL_MCP_ENV_BAKE`). Agent Plugins portable `${PLUGIN_*}` / secret-refuse stays on the AgentPlugins boundary.
