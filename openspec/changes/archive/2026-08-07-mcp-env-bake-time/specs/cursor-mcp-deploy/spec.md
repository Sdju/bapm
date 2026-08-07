## ADDED Requirements

### Requirement: Bake MCP env and headers before Cursor mcp.json write

When Cursor MCP deploy is about to write or update `.cursor/mcp.json` for eligible servers, the system MUST bake-resolve `env` and `headers` string values per the `mcp-env-bake` capability before durable write. Unresolved required placeholders MUST fail closed before a successful MCP config write that would persist those placeholders.

#### Scenario: Placeholder env becomes literal in mcp.json

- **WHEN** `bapm install --target cursor` deploys a direct MCP stdio server whose `env` uses `${API_TOKEN}` and `API_TOKEN` is set in the environment
- **THEN** `.cursor/mcp.json` MUST contain the literal token value under that server's `env`, not the placeholder string

#### Scenario: Unresolved placeholder blocks successful MCP write

- **WHEN** install would deploy MCP with an unresolved `${MISSING}` in `env` and no override supplies it
- **THEN** install MUST NOT succeed while leaving `${MISSING}` written in `.cursor/mcp.json` for that entry
