## ADDED Requirements

### Requirement: Install only-apm skips Cursor MCP configure

When install only-mode is `apm`, Cursor MCP deploy MUST NOT write or update `.cursor/mcp.json` for that invocation, even if the cursor target is otherwise active and eligible MCP servers exist. Package skill/rule/agent materialize MAY still occur. Behavior MUST be consistent with exclude-cursor MCP skip for the configure side.

#### Scenario: only apm leaves mcp.json unchanged

- **WHEN** install runs with only-mode `apm`, forced or detected cursor active, and eligible direct MCP
- **THEN** `.cursor/mcp.json` MUST remain unchanged (or absent if previously absent) and MUST NOT be created solely by configureMcp on that run
