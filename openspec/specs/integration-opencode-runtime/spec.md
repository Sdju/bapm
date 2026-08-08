# integration-opencode-runtime Specification

## Purpose

Defines the `@bapm/integration-opencode` package: OpenCode host detect, skill/agent/command materialize under `.opencode/`, MCP adaptation into project `opencode.json`, and compile to project-root `AGENTS.md` (including instructions), depending only on `@bapm/integration-api`.

## Requirements

### Requirement: Package @bapm/integration-opencode exists and depends only on integration API

The monorepo MUST include package directory `packages/integration-opencode` with package name `@bapm/integration-opencode`. The package MUST be TypeScript ESM with vite-plus tooling. Among bapm packages it MUST depend on `@bapm/integration-api` for types and contracts and MUST NOT require `@bapm/core` as a hard dependency for host capability implementation.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the OpenCode package dependencies
- **THEN** `@bapm/integration-opencode` depends on `@bapm/integration-api` and does not reverse-depend on `@bapm/core` for its host behavior

### Requirement: Detect uses OpenCode project signals

The OpenCode integration MUST provide a detection predicate that returns true when a project-root `.opencode/` directory exists, or when a project-root `opencode.json` or `opencode.jsonc` file exists. Detection MUST NOT invent signals by creating those paths solely to opt into auto-detect.

#### Scenario: Detect uses .opencode directory

- **WHEN** the project has a `.opencode/` directory and opencode is registered
- **THEN** opencode `detect` MUST return true

#### Scenario: Detect uses opencode.json

- **WHEN** the project has `opencode.json` at the project root and no `.opencode/` directory
- **THEN** opencode `detect` MUST return true

### Requirement: Skills materialize under .opencode/skills

When the OpenCode integration is active, skill primitives MUST materialize to `.opencode/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory (dereferenced, contained under plugin root) into that destination. Registered roots for an active opencode MUST include at least `.opencode`. Writes MUST NEVER escape registered roots. Skill materialize MUST NOT write `opencode.json` MCP entries as a side effect.

#### Scenario: Skill appears under OpenCode skills root

- **WHEN** install runs with the OpenCode integration registered and a dependency that provides a skill
- **THEN** the skill MUST appear at `.opencode/skills/<name>/SKILL.md` under a registered deploy root and MUST NOT be written outside those roots

#### Scenario: Portable skill directory is fully copied

- **WHEN** install runs with opencode active and a portable Agent Plugins skill with auxiliary files under `skillDirectory`
- **THEN** those auxiliary files MUST be present under `.opencode/skills/<name>/` after materialize

### Requirement: Agents materialize under .opencode/agents

When the OpenCode integration is active and the conflict-resolved primitive set contains agent primitives, each agent MUST materialize to `.opencode/agents/<name>.md` under a registered deploy root. Writes MUST NEVER escape registered roots. Agent materialize MUST NOT write MCP config as a side effect.

#### Scenario: Agent becomes OpenCode agent markdown

- **WHEN** install runs with opencode active and a dependency provides an agent primitive
- **THEN** a file MUST exist at `.opencode/agents/<name>.md` under a registered root

### Requirement: Forced target may create registered roots

When the OpenCode integration is activated by an explicit forced-target request (for example CLI `--target opencode`) rather than auto-detect, materialize MUST be allowed to create registered deploy root directories (including `.opencode/` as needed) even if no detect signal existed beforehand. Auto-detect without force MUST still require a detect signal and MUST NOT mkdir `.opencode/` solely to opt into MCP.

#### Scenario: Forced opencode creates roots

- **WHEN** install runs with forced target `opencode` registered and no `.opencode/` directory present
- **THEN** skills/agents MAY be written under registered roots after those roots are created

### Requirement: Not imported by core

`@bapm/core` MUST NOT hard-depend on or statically import `@bapm/integration-opencode`. Registration for CLI or e2e MUST occur through the integration API registry after object-map load (or an equivalent test harness registration).

#### Scenario: Core package graph excludes opencode

- **WHEN** inspecting `@bapm/core` dependencies
- **THEN** `@bapm/integration-opencode` MUST NOT appear as a dependency

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

### Requirement: MCP configure merges into project opencode.json

When install invokes OpenCode MCP configure with an eligible server set, `@bapm/integration-opencode` MUST create or update the project-root `opencode.json` under a registered deploy root that covers that path (or an explicitly registered `opencode.json` / `.opencode` containment rule documented by the package). Owned server entries MUST be written under the top-level `mcp` object keyed by server name. Mapping MUST use OpenCode’s documented shapes: portable/`stdio` → `{ type: "local", command: [command, ...args], environment? }`; portable `streamable-http` or host `http` → `{ type: "remote", url, headers? }`. Portable metadata MUST NOT be copied verbatim. Unsupported transports (including portable `sse` when OpenCode has no documented equivalent in this capability) MUST fail closed with a diagnostic and MUST NOT write a partial invented entry. Writes MUST be idempotent overwrites of owned keys, MUST preserve unrelated `opencode.json` keys and unrelated `mcp` server names, MUST NEVER escape registered roots, and MUST report config/deployed paths for lock inventory when the integration-api contract provides a report hook.

#### Scenario: Configure writes local MCP entry

- **WHEN** opencode MCP configure is invoked with a stdio server definition
- **THEN** project `opencode.json` MUST contain that server under `mcp` with `type: "local"` and a `command` array

#### Scenario: Configure maps portable HTTP to remote

- **WHEN** an installed portable plugin declares a `streamable-http` server and opencode configureMcp runs
- **THEN** `opencode.json` MUST contain a `type: "remote"` entry with the server URL rather than copying portable metadata verbatim

#### Scenario: Unsupported SSE fails closed

- **WHEN** configureMcp receives a portable `sse` server and OpenCode mapping for sse is not implemented
- **THEN** the command MUST fail closed (or emit a fail-closed diagnostic that prevents writing that server) and MUST NOT invent a local/remote entry for it

#### Scenario: Existing unrelated config is preserved

- **WHEN** `opencode.json` already contains unrelated keys and other `mcp` servers and configureMcp writes a new owned server
- **THEN** unrelated keys and other server names MUST remain intact

### Requirement: Instruction primitives are compile-only for OpenCode

Instruction primitives MUST NOT write OpenCode-native rules/instruction host files during materialize. The integration MUST keep install non-fatal for those primitives and MAY emit a non-fatal diagnostic identifying the skipped kind. Instruction content remains eligible for host `compile` output (`AGENTS.md`).

#### Scenario: Instruction does not materialize native OpenCode rules file

- **WHEN** OpenCode materialize runs with an instruction primitive
- **THEN** no OpenCode-native instruction/rules file MUST be created for that primitive under `.opencode/`
- **AND** install MUST remain non-fatal for that skip alone

### Requirement: Compile emits AGENTS.md including instructions

OpenCode runtime MUST expose `compile` that renders project-root `AGENTS.md` by default (overridable via compile output path context, basename MUST remain `AGENTS.md`). Instruction primitives MUST be included in the compiled body (compile-only guidance path). Emit MUST be deterministic for unchanged inputs. When compile write intent is false, content MUST still be returned without durable write. OpenCode shares the `AGENTS.md` compile family with Cursor and Codex: last writer wins per invocation (no merged multi-host document).

#### Scenario: Compile writes AGENTS.md

- **WHEN** OpenCode `compile` runs with write intent true and discoverable primitives
- **THEN** `AGENTS.md` MUST be written at the project root (or the provided relative output path whose basename is `AGENTS.md`) with deterministic content

#### Scenario: Instructions included in AGENTS.md body

- **WHEN** OpenCode `compile` receives instruction primitives alongside other kinds
- **THEN** the compiled `AGENTS.md` body MUST include those instruction primitives

#### Scenario: Preview does not write AGENTS.md

- **WHEN** OpenCode `compile` runs with write intent false
- **THEN** the report MUST return rendered content and MUST NOT create `AGENTS.md` on disk

#### Scenario: Lone AGENTS.md is not an OpenCode detect signal

- **WHEN** the project has `AGENTS.md` at the project root and neither `.opencode/` nor `opencode.json` / `opencode.jsonc`
- **THEN** OpenCode `detect` MUST return false
