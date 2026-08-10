## MODIFIED Requirements

### Requirement: Target MCP behavior is adapter-specific

Portable MCP entries MUST be treated as an input contract and adapted by targets rather than copied as a universal host configuration. The Cursor target MUST map portable `stdio` to Cursor `stdio`, `streamable-http` to Cursor `http`, and `sse` to Cursor `sse` in `.cursor/mcp.json`. The OpenCode target MUST map portable `stdio` to OpenCode `local` (`command` array) and portable `streamable-http` to OpenCode `remote` (`url`) under project `opencode.json` `mcp`; portable `sse` MUST NOT be silently remapped unless OpenCode documents an equivalent and the OpenCode integration implements it. No other target behavior is implied unless that target explicitly documents it.

#### Scenario: Cursor maps a portable HTTP server

- **WHEN** an installed portable plugin declares a `streamable-http` server and Cursor is active
- **THEN** Cursor writes an `http` server entry rather than copying portable metadata verbatim

#### Scenario: OpenCode maps a portable HTTP server

- **WHEN** an installed portable plugin declares a `streamable-http` server and OpenCode is active
- **THEN** OpenCode writes a `type: "remote"` entry under `opencode.json` `mcp` rather than copying portable metadata verbatim

### Requirement: End-to-end portable regression coverage

Regression coverage MUST exercise producer manifest creation, portable pack, safe extraction, consumer installation, complete skill directory materialization, and target MCP mapping. It MUST also retain unsafe-input rejection coverage. Coverage MUST include at least one path that installs a packed portable plugin into Cursor and one path that installs into OpenCode when `@b-apm/integration-opencode` is the active host.

#### Scenario: Packed portable plugin installs into Cursor

- **WHEN** a portable producer with a skill directory and MCP server is packed, extracted, and installed into a Cursor project
- **THEN** the skill auxiliary files are materialized and the MCP server is adapted under `.cursor/mcp.json`

#### Scenario: Packed portable plugin installs into OpenCode

- **WHEN** a portable producer with a skill directory and MCP server is packed, extracted, and installed into an OpenCode project with `@b-apm/integration-opencode` active
- **THEN** the skill auxiliary files are materialized under `.opencode/skills/` and the MCP server is adapted under project `opencode.json` `mcp`
