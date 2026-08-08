## ADDED Requirements

### Requirement: Commands materialize under .opencode/commands

When the OpenCode integration is active and the conflict-resolved primitive set contains command primitives, each command MUST materialize to `.opencode/commands/<name>.md` under a registered deploy root. Writes MUST NEVER escape registered roots. Command materialize MUST NOT write `opencode.json` MCP entries as a side effect.

#### Scenario: Command becomes OpenCode command markdown

- **WHEN** install runs with opencode active and a dependency provides a command primitive
- **THEN** a file MUST exist at `.opencode/commands/<name>.md` under a registered root

### Requirement: Hooks are explicitly skipped for OpenCode

When the OpenCode integration is active and the conflict-resolved primitive set contains hook primitives, OpenCode materialize MUST NOT write hook configuration for those primitives (APM host matrix: OpenCode hooks not supported). The integration MUST emit an inspectable skip diagnostic for hooks rather than silently dropping them with no signal. Skipping hooks MUST NOT by itself fail the install when other primitives deploy successfully, unless a separate fail-closed policy is explicitly configured.

#### Scenario: Hook primitive does not write OpenCode hooks

- **WHEN** install runs with opencode active and a dependency provides a hook primitive
- **THEN** no OpenCode hooks harness file MUST be written for that primitive and an inspectable skip diagnostic MUST be present
