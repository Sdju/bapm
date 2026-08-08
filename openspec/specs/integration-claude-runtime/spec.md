# integration-claude-runtime Specification

## Purpose

Defines Claude Code runtime behavior on `@bapm/integration-claude`: project detect, `.claude/` materialize for skills/instructions/agents/commands/hooks, project `.mcp.json` configure, optional `CLAUDE.md` compile, while marketplace pack mapping remains available from the same package.

## Requirements

### Requirement: Package exposes runtime factory and retains marketplace mapper

`@bapm/integration-claude` MUST continue to provide Claude marketplace-output mapping (including the documented default marketplace path) and MUST also export a runtime integration factory usable as `createIntegration` (and MAY export a Claude-named factory alias). The runtime integration MUST implement `BapmIntegration` (`id`, `deployRoots`, `detect`, `materialize`) and MUST depend on `@bapm/integration-api` without requiring `@bapm/core` as a hard dependency for host behavior. Package id for the runtime target MUST be `claude`.

#### Scenario: Runtime factory registers as claude

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `claude` and MUST expose `detect` and `materialize`

#### Scenario: Marketplace mapper remains available

- **WHEN** pack loads Claude marketplace-output capability from `@bapm/integration-claude`
- **THEN** the Claude marketplace document mapping and default output path MUST still be available without requiring runtime activation

### Requirement: Detect uses Claude project signals

The Claude integration MUST return true from `detect` when a project-root `.claude/` directory exists, or when a project-root `CLAUDE.md` file exists. Detection MUST NOT create those paths solely to opt into auto-detect.

#### Scenario: Detect uses .claude directory

- **WHEN** the project has a `.claude/` directory and claude is registered
- **THEN** claude `detect` MUST return true

#### Scenario: Detect uses CLAUDE.md

- **WHEN** the project has `CLAUDE.md` at the project root and no `.claude/` directory
- **THEN** claude `detect` MUST return true

#### Scenario: Detect does not invent signals

- **WHEN** neither `.claude/` nor `CLAUDE.md` exists
- **THEN** claude `detect` MUST return false and MUST NOT create those paths

### Requirement: Deploy roots cover .claude and constrained root files

Registered default deploy roots for Claude MUST include `.claude` and MUST cover project-root files the host writes (`.mcp.json` and compile `CLAUDE.md`) via an explicit root registration or equivalent containment rule. Materialize writes for skills, instructions, agents, commands, hooks config, and hook scripts MUST stay under `.claude/`. Root-level writers MUST NOT write arbitrary paths under `.`.

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a path outside registered deploy roots
- **THEN** the write MUST fail closed (throw or equivalent hard failure) and MUST NOT create the escaped path

### Requirement: Skills materialize under .claude/skills

When Claude is active, skill primitives MUST materialize to `.claude/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory (dereferenced, contained under plugin root) into that destination. Skill materialize MUST NOT write `.agents/skills/` and MUST NOT write MCP config as a side effect.

#### Scenario: Skill appears under Claude skills root

- **WHEN** install runs with Claude registered and a dependency provides a skill
- **THEN** the skill MUST appear at `.claude/skills/<name>/SKILL.md` and MUST NOT be written under `.agents/skills/`

#### Scenario: Portable skill directory is fully copied

- **WHEN** install runs with Claude active and a portable Agent Plugins skill with auxiliary files under `skillDirectory`
- **THEN** those auxiliary files MUST be present under `.claude/skills/<name>/` after materialize

### Requirement: Instructions materialize as Claude rules with paths frontmatter

Instruction primitives MUST materialize to `.claude/rules/<name>.md`. Portable `applyTo` frontmatter MUST be transformed to Claude `paths:` frontmatter (YAML list). Instructions without `applyTo` MUST deploy as unconditional rule bodies without inventing a `paths` key. Writes MUST stay under registered roots.

#### Scenario: Path-scoped instruction becomes paths frontmatter

- **WHEN** an instruction primitive with `applyTo` is materialized for Claude
- **THEN** `.claude/rules/<name>.md` MUST exist and MUST include a `paths:` frontmatter list derived from `applyTo`

#### Scenario: Unconditional instruction omits paths

- **WHEN** an instruction primitive without `applyTo` is materialized for Claude
- **THEN** `.claude/rules/<name>.md` MUST exist and MUST NOT invent a `paths` frontmatter key solely for that rule

### Requirement: Agents and commands materialize under .claude

Agent primitives MUST materialize to `.claude/agents/<name>.md`. Command primitives MUST materialize to `.claude/commands/<name>.md`. Command frontmatter MUST preserve only the documented shared subset and MUST surface dropped unsupported keys via diagnostics when keys are removed. Agent/command materialize MUST NOT write MCP config as a side effect.

#### Scenario: Agent becomes Claude agent markdown

- **WHEN** Claude materialize runs with an agent primitive
- **THEN** a file MUST exist at `.claude/agents/<name>.md` under a registered root

#### Scenario: Command becomes Claude command markdown

- **WHEN** Claude materialize runs with a command primitive
- **THEN** a file MUST exist at `.claude/commands/<name>.md` under a registered root

### Requirement: Hooks merge into settings.json with ownership sidecar

Hook primitives MUST merge into `.claude/settings.json` under the native hooks structure Claude Code expects, copying referenced scripts under `.claude/hooks/` as needed. The package MUST maintain a project sidecar at `.claude/bapm-hooks.json` recording bapm-owned hook entries/scripts so reinstall can remove previously owned entries before re-merge. Native `settings.json` MUST preserve unrelated top-level keys and non-owned hook handlers. Ownership metadata MUST NOT be left as Claude-native private keys inside handler objects in `settings.json`.

#### Scenario: Hooks merge into settings.json

- **WHEN** Claude materialize runs with a valid hook primitive JSON
- **THEN** `.claude/settings.json` MUST contain the merged hook handlers and unrelated existing settings keys MUST remain intact

#### Scenario: Reinstall replaces owned hooks only

- **WHEN** Claude materialize runs again after a prior owned hooks deploy
- **THEN** previously bapm-owned hook entries MUST be replaced according to the sidecar and non-owned handlers MUST remain

### Requirement: Forced target may create .claude roots

When Claude is activated by an explicit forced-target request (for example CLI `--target claude`) rather than auto-detect alone, materialize MUST be allowed to create registered `.claude/` directories as needed even if no detect signal existed beforehand. Auto-detect without force MUST still require a detect signal and MUST NOT mkdir `.claude/` solely to opt into detect or MCP.

#### Scenario: Forced claude creates roots

- **WHEN** install runs with forced target `claude` registered and no `.claude/` directory present
- **THEN** skills/rules/agents/commands/hooks MAY be written under `.claude/` after those roots are created

### Requirement: Project MCP configure writes .mcp.json when .claude exists

Claude MUST expose optional `configureMcp`. For project scope it MUST create or update project-root `.mcp.json` with top-level `mcpServers`, merging owned server entries by name while preserving unrelated servers and unrelated top-level keys. Writes MUST be opt-in only when a project `.claude/` directory exists; otherwise configure MUST skip writing with a diagnostic and MUST NOT invent user-scope or local `projects.*` MCP paths. Stdio-shaped servers MUST normalize to Claude Code’s on-disk stdio shape (including explicit `type: "stdio"` when applicable). When a server `command` begins with `.agents/skills/`, configure MUST rewrite that prefix to `.claude/skills/` so launchers match Claude’s native skill deploy root. Unsupported or invalid servers MUST fail closed for that server (diagnostic) without inventing unsafe entries. Reports MUST include config/deployed paths suitable for lock inventory.

#### Scenario: Configure writes mcpServers when .claude exists

- **WHEN** Claude `configureMcp` runs with an eligible stdio server and `.claude/` exists
- **THEN** project `.mcp.json` MUST contain that server under `mcpServers` with Claude-compatible stdio shape

#### Scenario: Configure skips when .claude is absent

- **WHEN** Claude `configureMcp` runs and `.claude/` does not exist
- **THEN** configure MUST NOT write `.mcp.json` for project scope and MUST emit a skip/diagnostic outcome

#### Scenario: Skill launcher path is rewritten

- **WHEN** configure receives a stdio server whose command starts with `.agents/skills/`
- **THEN** the written command MUST start with `.claude/skills/` instead

#### Scenario: Existing unrelated MCP servers are preserved

- **WHEN** `.mcp.json` already contains other `mcpServers` entries and configure writes a new owned server
- **THEN** unrelated server names MUST remain intact

### Requirement: Compile emits CLAUDE.md and omits rules-bound instructions

Claude runtime MUST expose `compile` that renders project-root `CLAUDE.md` by default (overridable via compile output path context). Instruction primitives MUST be omitted from the compiled body so guidance deployed under `.claude/rules/` is not duplicated. Emit MUST be deterministic for unchanged inputs. When compile write intent is false, content MUST still be returned without durable write.

#### Scenario: Compile writes CLAUDE.md

- **WHEN** Claude `compile` runs with write intent true and discoverable non-instruction primitives
- **THEN** `CLAUDE.md` MUST be written at the project root (or the provided relative output path) with deterministic content

#### Scenario: Instructions omitted from CLAUDE.md body

- **WHEN** Claude `compile` receives instruction primitives alongside other kinds
- **THEN** the compiled `CLAUDE.md` body MUST NOT include those instruction primitives as duplicate sections

#### Scenario: Validate/preview does not write

- **WHEN** Claude `compile` runs with write intent false
- **THEN** the report MUST include rendered content and path and MUST NOT create or rewrite the output file

### Requirement: Not imported by core

`@bapm/core` MUST NOT hard-depend on or statically import `@bapm/integration-claude` for Claude runtime behavior. Registration MUST occur through the integration API registry after object-map / dynamic load (or test harness registration).

#### Scenario: Core package graph excludes claude runtime hard-dep

- **WHEN** inspecting `@bapm/core` production dependencies
- **THEN** `@bapm/integration-claude` MUST NOT appear as a required runtime dependency of core
