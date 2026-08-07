# integration-cursor-runtime Specification

## Purpose

Defines the `bapm-integration-cursor` package at `packages/integration-cursor`: Cursor host implementation that materializes skills into registered Cursor-related deploy roots, depending only on `bapm-integration-api`.

## Requirements

### Requirement: Package bapm-integration-cursor exists and depends only on integration API

The monorepo MUST include package directory `packages/integration-cursor` with package name `bapm-integration-cursor`. The package MUST be TypeScript ESM with vite-plus tooling. Among bapm packages it MUST depend on `bapm-integration-api` for types and contracts and MUST NOT require `@bapm/core` as a hard dependency for host capability implementation.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the Cursor package dependencies after migration
- **THEN** `bapm-integration-cursor` depends on `bapm-integration-api` and does not reverse-depend on `@bapm/core` for its host behavior

### Requirement: Minimal detect and skills materialize under registered roots

The Cursor integration MUST provide a detection predicate that returns true when `.cursor/` exists as a directory (canonical) and, per the legacy signal requirement, when `.cursorrules` exists as a file. The integration MUST materialize skills into its registered deploy root(s) only. When skills are deployed, paths MUST follow OpenAPM tg-003 preference for `.agents/skills/<name>/SKILL.md` unless the package documents a cursor-native registered root opt-out. Registered roots for an active cursor MUST include at least `.agents/skills` and `.cursor` (and subpaths used for rules/agents). Writes MUST NEVER escape registered roots (tg-002). Skills/instructions/agents materialize MUST NOT write `.cursor/mcp.json` as a side effect; MCP config writes are owned by the MCP configure path (see MCP configure requirement).

#### Scenario: Cursor e2e skills under registered root

- **WHEN** install runs with the Cursor integration registered and a dependency that provides a skill
- **THEN** the skill MUST appear under a registered deploy root (prefer `.agents/skills/<name>/SKILL.md` if tg-003 is claimed) and MUST NOT be written outside those roots

#### Scenario: Detect uses cursor directory

- **WHEN** the project has a `.cursor/` directory and cursor is registered
- **THEN** cursor `detect` MUST return true

### Requirement: Instructions deploy to cursor rules mdc

When the Cursor integration is active and the conflict-resolved primitive set contains instruction primitives, the Cursor integration MUST materialize each instruction to `.cursor/rules/<name>.mdc` under a registered deploy root. Writes MUST NEVER escape registered roots (tg-002). Instruction materialize MUST NOT write `.cursor/mcp.json`; MCP configuration is written only via the MCP configure path when install requests it.

#### Scenario: Instruction becomes rules mdc

- **WHEN** install runs with cursor active and a dependency provides an instruction primitive and no MCP deploy is requested
- **THEN** a file MUST exist at `.cursor/rules/<name>.mdc` under a registered root and `.cursor/mcp.json` MUST NOT be created solely by instruction materialize

### Requirement: Agents deploy to cursor agents md

When the Cursor integration is active and the conflict-resolved primitive set contains agent primitives, the Cursor integration MUST materialize each agent to `.cursor/agents/<name>.md` under a registered deploy root. Writes MUST NEVER escape registered roots (tg-002).

#### Scenario: Agent becomes cursor agent file

- **WHEN** install runs with cursor active and a dependency provides an agent primitive
- **THEN** a file MUST exist at `.cursor/agents/<name>.md` under a registered root

### Requirement: Legacy cursorrules detect signal

In addition to the `.cursor/` directory signal, the Cursor integration's detection predicate MUST treat a legacy `.cursorrules` **file** at the project root as a positive detect signal for auto-activation.

#### Scenario: Legacy file activates detect

- **WHEN** the project has a `.cursorrules` file and no `.cursor/` directory
- **THEN** cursor `detect` MUST return true

### Requirement: Skills materialize is idempotent under registered roots

Re-running materialize for the same conflict-resolved skill set MUST leave skill content matching the source under `.agents/skills/<name>/SKILL.md` (or the documented registered skill root) and MUST exit successfully without writing outside registered roots. Only conflict-resolved primitives MUST be written.

#### Scenario: Re-install skills is idempotent

- **WHEN** a skill already exists at `.agents/skills/foo/SKILL.md` and install re-runs with the same conflict-resolved set
- **THEN** the file content MUST match the source skill and no harness path outside registered roots MUST be written

### Requirement: Forced target may create registered roots without prior cursor dir

When the Cursor integration is activated by an explicit forced-target request (for example CLI `--target cursor`) rather than auto-detect, materialize MUST be allowed to create registered deploy root directories (including `.cursor/` and `.agents/skills` as needed) even if neither `.cursor/` nor `.cursorrules` existed beforehand. Auto-detect without force MUST still require a detect signal and MUST NOT mkdir `.cursor/` solely to opt into MCP.

#### Scenario: Forced cursor creates roots

- **WHEN** install runs with forced target `cursor` registered and no `.cursor/` directory present
- **THEN** skills/instructions/agents MAY be written under registered roots after those roots are created

#### Scenario: Auto-detect without signal skips harness create

- **WHEN** install runs without forced target and neither `.cursor/` nor `.cursorrules` is present
- **THEN** cursor materialize MUST NOT run solely to create `.cursor/` for MCP or harness opt-in

### Requirement: Not imported by core

`@bapm/core` MUST NOT hard-depend on or statically import `bapm-integration-cursor`. Registration for CLI or e2e MUST occur in a composition root or test harness through the integration API registry.

#### Scenario: Core package graph excludes cursor

- **WHEN** inspecting `@bapm/core` dependencies
- **THEN** `bapm-integration-cursor` MUST NOT appear as a dependency

### Requirement: MCP configure writes cursor mcp.json

When install invokes Cursor MCP configure with an eligible server set, `bapm-integration-cursor` MUST write or update `.cursor/mcp.json` in Cursor `mcpServers` shape (stdio/http) under the registered `.cursor/` root only. Writes MUST be idempotent overwrites of owned keys, MUST NEVER escape registered roots, and MUST report deployed/config paths for lock inventory when the integration-api contract provides a report hook.

#### Scenario: Configure writes mcpServers entry

- **WHEN** cursor MCP configure is invoked with a stdio server definition
- **THEN** `.cursor/mcp.json` MUST contain that server under `mcpServers` inside a registered root

#### Scenario: Configure does not escape roots

- **WHEN** cursor MCP configure runs
- **THEN** no file outside registered deploy roots MUST be written for MCP config

### Requirement: Cursor integration retains runtime behavior after specification rename

The active Cursor integration specification MUST describe `bapm-integration-cursor` using integration-neutral terminology and retain its documented detection, primitive deployment, MCP configuration, compile-emission, path-safety, and inventory-report behavior.

#### Scenario: Cursor capability remains observable through integration API

- **WHEN** install or compile selects the registered Cursor integration after the active specification rename
- **THEN** the observable files, registered-root safety, and reports remain equivalent to the pre-cleanup behavior

### Requirement: configureMcp persists bake-resolved env and headers

When Cursor `configureMcp` writes `mcpServers` entries, `env` and `headers` values that participated in bake-time resolution MUST be the baked literals (or omit unresolved maps by failing before write). The integration MUST NOT invent Cursor runtime env-substitution as a replacement for bake. Literal env maps without placeholders MUST continue to round-trip as today.

#### Scenario: configureMcp writes baked env literals

- **WHEN** configureMcp receives (or bake-resolves) a server whose env placeholder resolved to a literal
- **THEN** `.cursor/mcp.json` under the registered `.cursor/` root MUST store that literal under `mcpServers.<name>.env`

#### Scenario: Plain env without placeholders still writes

- **WHEN** configureMcp receives a server with `env: { FOO: "bar" }` and no placeholders
- **THEN** `.cursor/mcp.json` MUST still contain `FOO: "bar"` as today
