## ADDED Requirements

### Requirement: MCP configuration inventory preserves target identity

Lockfile load and serialize MUST preserve MCP configuration inventory entries keyed by their existing target identifiers. When install adds or updates an MCP configuration entry for a target, the serialized inventory MUST use that target identifier and the project-relative path reported by its target configure contract. Lockfile serialization MUST NOT rename, remove, or rewrite legacy MCP inventory entries solely because they use an older key or path shape.

#### Scenario: Target-keyed MCP inventory round-trips

- **WHEN** a lock contains MCP configuration inventory for `x-acme-editor` with path `config/mcp.json`
- **THEN** load followed by serialize MUST retain that target id and path

#### Scenario: Legacy MCP inventory remains intact

- **WHEN** a lock contains a legacy Cursor-shaped MCP inventory entry and an unrelated target entry
- **THEN** load followed by serialize MUST retain both entries unchanged
