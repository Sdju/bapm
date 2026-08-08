## ADDED Requirements

### Requirement: Commands deploy to cursor commands markdown

When the Cursor integration is active and the conflict-resolved primitive set contains command primitives, the Cursor integration MUST materialize each command to `.cursor/commands/<name>.md` under a registered deploy root. Content MUST use the Claude-format command subset appropriate for Cursor (preserve frontmatter keys needed for slash-commands such as `description`, `allowed-tools`, `model`, `argument-hint`, and `input` when present). Non-preserved prompt-only frontmatter keys MUST be dropped; when keys are dropped, the integration MUST emit an inspectable diagnostic. Writes MUST NEVER escape registered roots. Command materialize MUST NOT write `.cursor/mcp.json` as a side effect.

#### Scenario: Command becomes cursor slash-command file

- **WHEN** install runs with cursor active and a dependency provides a command primitive
- **THEN** a file MUST exist at `.cursor/commands/<name>.md` under a registered root

#### Scenario: Prompt-only frontmatter is dropped with diagnostic

- **WHEN** a command source frontmatter contains a non-preserved key such as `author` or `mcp`
- **THEN** the deployed `.cursor/commands/<name>.md` MUST omit that key and an inspectable diagnostic MUST record the drop

### Requirement: Hooks merge into cursor hooks.json

When the Cursor integration is active and the conflict-resolved primitive set contains hook primitives, the Cursor integration MUST merge hook definitions into `.cursor/hooks.json` under a registered deploy root (Cursor flat `command` shape). Referenced hook scripts MUST be copied under a registered `.cursor/` subpath (for example `.cursor/hooks/`) with path rewriting so deployed JSON does not point outside registered roots. Ownership of bapm-managed hook entries MUST be tracked (sidecar and/or lock inventory) so re-install is idempotent and uninstall/orphan cleanup can remove owned entries without deleting unrelated user-authored hooks. Writes MUST NEVER escape registered roots. Hook materialize MUST NOT write `.cursor/mcp.json` as a side effect.

#### Scenario: Hook merges into hooks.json

- **WHEN** install runs with cursor active and a dependency provides a hook primitive
- **THEN** `.cursor/hooks.json` under a registered root MUST contain the merged hook definition

#### Scenario: Hook scripts stay under registered roots

- **WHEN** a hook JSON references a script path inside the package
- **THEN** the script MUST be copied under a registered `.cursor/` path and the merged JSON MUST reference the rewritten path

#### Scenario: User-owned hooks are preserved

- **WHEN** `.cursor/hooks.json` already contains unrelated user-authored hook entries and bapm merges owned hooks
- **THEN** the unrelated entries MUST remain intact after materialize
