## ADDED Requirements

### Requirement: MCP lock inventory is keyed by the configuring target
When a registered target successfully configures MCP and reports its configuration path, non-frozen install MUST record the MCP configuration inventory under that target's id and with that reported path. Core MUST NOT substitute a Cursor id or a Cursor filesystem path for a different target. Existing MCP inventory entries that were loaded from the lock but were not written by the current configure operation MUST be preserved unchanged.

#### Scenario: Non-Cursor target writes its own MCP inventory
- **WHEN** an active registered target with id `x-acme-editor` configures MCP and reports `config/mcp.json`
- **THEN** the updated lock MUST record `x-acme-editor` with `config/mcp.json` in its MCP configuration inventory and MUST NOT add a Cursor-path entry for that operation

#### Scenario: Existing legacy inventory is preserved
- **WHEN** a lock already contains a legacy MCP inventory entry and another registered target configures MCP
- **THEN** lock write-back MUST preserve the legacy entry unchanged while adding or updating the configuring target's inventory

#### Scenario: Configure without a path fails before lock write-back
- **WHEN** an active target reports successful MCP configuration without a non-empty project-relative path
- **THEN** install MUST fail without writing a replacement MCP inventory entry
