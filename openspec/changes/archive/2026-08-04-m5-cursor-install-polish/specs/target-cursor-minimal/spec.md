## ADDED Requirements

### Requirement: Instructions deploy to cursor rules mdc

When the cursor target is active and the conflict-resolved primitive set contains instruction primitives, the cursor target MUST materialize each instruction to `.cursor/rules/<name>.mdc` under a registered deploy root. Writes MUST NEVER escape registered roots (tg-002). MCP configuration files such as `.cursor/mcp.json` MUST NOT be written by this target in M5.

#### Scenario: Instruction becomes rules mdc

- **WHEN** install runs with cursor active and a dependency provides an instruction primitive
- **THEN** a file MUST exist at `.cursor/rules/<name>.mdc` under a registered root and `.cursor/mcp.json` MUST NOT be created by cursor materialize

### Requirement: Agents deploy to cursor agents md

When the cursor target is active and the conflict-resolved primitive set contains agent primitives, the cursor target MUST materialize each agent to `.cursor/agents/<name>.md` under a registered deploy root. Writes MUST NEVER escape registered roots (tg-002).

#### Scenario: Agent becomes cursor agent file

- **WHEN** install runs with cursor active and a dependency provides an agent primitive
- **THEN** a file MUST exist at `.cursor/agents/<name>.md` under a registered root

### Requirement: Legacy cursorrules detect signal

In addition to the `.cursor/` directory signal, the cursor target's detection predicate MUST treat a legacy `.cursorrules` **file** at the project root as a positive detect signal for auto-activation.

#### Scenario: Legacy file activates detect

- **WHEN** the project has a `.cursorrules` file and no `.cursor/` directory
- **THEN** cursor `detect` MUST return true

### Requirement: Skills materialize is idempotent under registered roots

Re-running materialize for the same conflict-resolved skill set MUST leave skill content matching the source under `.agents/skills/<name>/SKILL.md` (or the documented registered skill root) and MUST exit successfully without writing outside registered roots. Only conflict-resolved primitives MUST be written.

#### Scenario: Re-install skills is idempotent

- **WHEN** a skill already exists at `.agents/skills/foo/SKILL.md` and install re-runs with the same conflict-resolved set
- **THEN** the file content MUST match the source skill and no harness path outside registered roots MUST be written

### Requirement: Forced target may create registered roots without prior cursor dir

When the cursor target is activated by an explicit forced-target request (for example CLI `--target cursor`) rather than auto-detect, materialize MUST be allowed to create registered deploy root directories (including `.cursor/` and `.agents/skills` as needed) even if neither `.cursor/` nor `.cursorrules` existed beforehand. Auto-detect without force MUST still require a detect signal and MUST NOT mkdir `.cursor/` solely to opt into MCP.

#### Scenario: Forced cursor creates roots

- **WHEN** install runs with forced target `cursor` registered and no `.cursor/` directory present
- **THEN** skills/instructions/agents MAY be written under registered roots after those roots are created

#### Scenario: Auto-detect without signal skips harness create

- **WHEN** install runs without forced target and neither `.cursor/` nor `.cursorrules` is present
- **THEN** cursor materialize MUST NOT run solely to create `.cursor/` for MCP or harness opt-in

## MODIFIED Requirements

### Requirement: Minimal detect and skills materialize under registered roots

The cursor target MUST provide a detection predicate that returns true when `.cursor/` exists as a directory (canonical) and, per the legacy signal requirement, when `.cursorrules` exists as a file. The target MUST materialize skills into its registered deploy root(s) only. When skills are deployed, paths MUST follow OpenAPM tg-003 preference for `.agents/skills/<name>/SKILL.md` unless the package documents a cursor-native registered root opt-out. Registered roots for an active cursor MUST include at least `.agents/skills` and `.cursor` (and subpaths used for rules/agents). Writes MUST NEVER escape registered roots (tg-002). The target MUST NOT write `.cursor/mcp.json` in this change.

#### Scenario: Cursor e2e skills under registered root

- **WHEN** install runs with the cursor target registered and a dependency that provides a skill
- **THEN** the skill MUST appear under a registered deploy root (prefer `.agents/skills/<name>/SKILL.md` if tg-003 is claimed) and MUST NOT be written outside those roots

#### Scenario: Detect uses cursor directory

- **WHEN** the project has a `.cursor/` directory and cursor is registered
- **THEN** cursor `detect` MUST return true
