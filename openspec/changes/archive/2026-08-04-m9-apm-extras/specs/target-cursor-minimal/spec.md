## MODIFIED Requirements

### Requirement: Minimal detect and skills materialize under registered roots
The cursor target MUST provide a detection predicate that returns true when `.cursor/` exists as a directory (canonical) and, per the legacy signal requirement, when `.cursorrules` exists as a file. The target MUST materialize skills into its registered deploy root(s) only. When skills are deployed, paths MUST follow OpenAPM tg-003 preference for `.agents/skills/<name>/SKILL.md` unless the package documents a cursor-native registered root opt-out. Registered roots for an active cursor MUST include at least `.agents/skills` and `.cursor` (and subpaths used for rules/agents). Writes MUST NEVER escape registered roots (tg-002). Skills/instructions/agents materialize MUST NOT write `.cursor/mcp.json` as a side effect; MCP config writes are owned by the MCP configure path (see MCP configure requirement).

#### Scenario: Cursor e2e skills under registered root
- **WHEN** install runs with the cursor target registered and a dependency that provides a skill
- **THEN** the skill MUST appear under a registered deploy root (prefer `.agents/skills/<name>/SKILL.md` if tg-003 is claimed) and MUST NOT be written outside those roots

#### Scenario: Detect uses cursor directory
- **WHEN** the project has a `.cursor/` directory and cursor is registered
- **THEN** cursor `detect` MUST return true

### Requirement: Instructions deploy to cursor rules mdc
When the cursor target is active and the conflict-resolved primitive set contains instruction primitives, the cursor target MUST materialize each instruction to `.cursor/rules/<name>.mdc` under a registered deploy root. Writes MUST NEVER escape registered roots (tg-002). Instruction materialize MUST NOT write `.cursor/mcp.json`; MCP configuration is written only via the MCP configure path when install requests it.

#### Scenario: Instruction becomes rules mdc
- **WHEN** install runs with cursor active and a dependency provides an instruction primitive and no MCP deploy is requested
- **THEN** a file MUST exist at `.cursor/rules/<name>.mdc` under a registered root and `.cursor/mcp.json` MUST NOT be created solely by instruction materialize

## ADDED Requirements

### Requirement: MCP configure writes cursor mcp.json
When install invokes Cursor MCP configure with an eligible server set, `bapm-target-cursor` MUST write or update `.cursor/mcp.json` in Cursor `mcpServers` shape (stdio/http) under the registered `.cursor/` root only. Writes MUST be idempotent overwrites of owned keys, MUST NEVER escape registered roots, and MUST report deployed/config paths for lock inventory when the target-api contract provides a report hook.

#### Scenario: Configure writes mcpServers entry
- **WHEN** cursor MCP configure is invoked with a stdio server definition
- **THEN** `.cursor/mcp.json` MUST contain that server under `mcpServers` inside a registered root

#### Scenario: Configure does not escape roots
- **WHEN** cursor MCP configure runs
- **THEN** no file outside registered deploy roots MUST be written for MCP config
