## ADDED Requirements

### Requirement: Excluded cursor skips MCP configure writes
When install’s exclude set includes `cursor`, Cursor MCP deploy MUST NOT write or update `.cursor/mcp.json` for that invocation, even if the cursor target is otherwise active and eligible MCP servers exist. Package skill/rule/agent materialize MAY still occur. A warning or diagnostic that MCP configure was skipped SHOULD be emitted when inexpensive.

#### Scenario: Exclude cursor leaves mcp.json untouched
- **WHEN** install runs with exclude including `cursor`, forced or detected cursor active, and eligible direct MCP
- **THEN** `.cursor/mcp.json` MUST remain unchanged (or absent if previously absent) and MUST NOT be created solely by configureMcp on that run
