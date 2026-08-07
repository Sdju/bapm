## MODIFIED Requirements

### Requirement: Lock mcp fields updated after MCP deploy

When Cursor MCP configuration is written, lock write-back MUST populate or update applicable top-level `mcp_*` fields (`mcp_servers`, `mcp_configs`, `mcp_target_servers`, `mcp_config_provenance` as modeled) consistently with APM lock spirit, while preserving unknown/`x-*` keys. Cursor's registered target MCP configure report MUST supply `.cursor/mcp.json` as the written configuration path; core MUST consume that reported path through the target API rather than supplying a Cursor-specific fallback.

#### Scenario: Lock lists configured MCP after install

- **WHEN** a non-frozen install successfully writes Cursor MCP config
- **THEN** the lockfile MUST include MCP inventory fields covering the configured servers

#### Scenario: Cursor report supplies its configuration path

- **WHEN** Cursor successfully configures eligible MCP servers
- **THEN** its target configure report MUST identify `.cursor/mcp.json` as the written configuration path
