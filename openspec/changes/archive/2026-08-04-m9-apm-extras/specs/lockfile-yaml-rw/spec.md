## ADDED Requirements

### Requirement: Populate mcp inventory fields when MCP configs written

When install writes Cursor MCP configuration, lock serialize/write-back MUST populate or update first-class (or already-known optional) top-level MCP inventory fields—`mcp_servers`, `mcp_configs`, `mcp_target_servers`, and/or `mcp_config_provenance` as applicable—so subsequent load→serialize preserves them. Unknown/`x-*` keys MUST still round-trip. Absence of MCP deploy MUST NOT require inventing empty MCP blocks.

#### Scenario: MCP fields present after MCP install write-back

- **WHEN** a lock is written after successful Cursor MCP deploy
- **THEN** emitted YAML MUST include the applicable `mcp_*` inventory covering configured servers

#### Scenario: No MCP leaves mcp blocks optional

- **WHEN** a lock is written for an install without MCP deploy
- **THEN** serialize MUST NOT be required to emit empty `mcp_*` placeholders
