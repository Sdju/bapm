## Purpose

Project-scope Kiro IDE/CLI v3 runtime for bapm via `@bapm/integration-kiro`: detect `.kiro/`, materialize steering/agents/skills/hooks, configure translate MCP, and thin-compile `AGENTS.md`.

## ADDED Requirements

### Requirement: Package exposes createIntegration factory

The system MUST provide workspace package `@bapm/integration-kiro` that exports `createKiroIntegration` and `createIntegration` (alias) returning a `BapmIntegration` with `id` defaulting to `kiro`, `deployRoots` including `.kiro`, and `mcpEnvMode` equal to `translate`. The package MUST depend on `@bapm/integration-api` for the runtime contract and MUST NOT hard-depend on `@bapm/core`.

#### Scenario: Factory registers as kiro with translate MCP mode

- **WHEN** a consumer calls `createIntegration()` with no options
- **THEN** the returned integration has `id` `kiro`, `deployRoots` containing `.kiro`, and `mcpEnvMode` `translate`

### Requirement: Detect project .kiro directory

The Kiro integration `detect` MUST return true only when `<cwd>/.kiro` exists as a directory. Detect MUST NOT create directories or files.

#### Scenario: Detects existing .kiro folder

- **WHEN** `detect` runs against a cwd that contains a `.kiro/` directory
- **THEN** it returns true

#### Scenario: Does not detect absent .kiro

- **WHEN** `detect` runs against a cwd without `.kiro/`
- **THEN** it returns false and the filesystem under cwd is unchanged

### Requirement: Materialize steering from instructions

On materialize, instruction primitives MUST be written to `.kiro/steering/<name>.md` under registered deploy roots. When source frontmatter includes `applyTo`, the written file MUST use `inclusion: fileMatch` and `fileMatchPattern` derived from `applyTo` (comma-separated values become a YAML list). When `applyTo` is absent, the written file MUST use `inclusion: always`.

#### Scenario: Scoped instruction becomes fileMatch steering

- **WHEN** an instruction primitive with `applyTo: "src/**/*.ts"` is materialized for kiro
- **THEN** `.kiro/steering/<name>.md` exists with `inclusion: fileMatch` and a `fileMatchPattern` covering `src/**/*.ts`

#### Scenario: Unscoped instruction becomes always steering

- **WHEN** an instruction primitive without `applyTo` is materialized for kiro
- **THEN** `.kiro/steering/<name>.md` exists with `inclusion: always`

### Requirement: Materialize agents with frontmatter strip and tools fail-closed

On materialize, agent primitives MUST be written to `.kiro/agents/<stem>.md`. Preserved frontmatter keys MUST be limited to `description`, `model`, and `tools`. Keys including `name` and any other unknown fields MUST be stripped. Identity MUST derive from the deployed path, not a `name` field. When `tools` is present, each tool tag MUST be one of: `read`, `write`, `shell`, `web`, `subagent`, `knowledge`, `context`, `todo_list`, `@mcp`, `@builtin`, `*`. If any tool is outside that set, the agent MUST NOT be written (zero bytes) and a diagnostic MUST be reported.

#### Scenario: Keeps only Kiro-allowed frontmatter

- **WHEN** an agent with frontmatter keys `name`, `description`, `model`, `tools`, and `color` is materialized
- **THEN** the deployed file frontmatter contains only `description`, `model`, and `tools`

#### Scenario: Fail-closed on unsupported tools

- **WHEN** an agent declares a tool tag outside the Kiro allowed set
- **THEN** no file is created under `.kiro/agents/` for that agent and the materialize report includes a diagnostic about incompatible tools

### Requirement: Materialize skills under .kiro/skills

On materialize, skill primitives MUST deploy via the Agent Skills layout to `.kiro/skills/<name>/SKILL.md` (and companion files). Skills MUST NOT be written to `.agents/skills/` for this target.

#### Scenario: Skill lands under .kiro/skills

- **WHEN** a skill primitive is materialized for kiro
- **THEN** `.kiro/skills/<name>/SKILL.md` exists and `.agents/skills/<name>/SKILL.md` does not

### Requirement: Materialize per-file Kiro v1 hooks

On materialize, hook primitives MUST expand into individual JSON documents under `.kiro/hooks/` using Kiro **v1** shape: top-level `version: "v1"` and a `hooks` array of objects with `name`, `trigger`, `action` (`type` `command`|`agent`), and optional `matcher`. Legacy rich non-v3 layouts (for example top-level `when`/`then`) MUST NOT be written. Referenced hook scripts MUST be copied under `.kiro/hooks/<package>/…` with commands rewritten to project-relative paths.

#### Scenario: Hook expands to v1 JSON file

- **WHEN** a hook primitive with a PreToolUse command handler is materialized for kiro
- **THEN** a file under `.kiro/hooks/` exists whose JSON has `version` `v1` and a `hooks[0].trigger` of `PreToolUse` with `action.type` `command`

### Requirement: Skip prompts and commands

Kiro materialize MUST NOT deploy `command` / prompt primitives to any `.kiro/` path (APM matrix N). Such primitives MAY be ignored or reported as skipped diagnostics without writing files.

#### Scenario: Command primitive writes no kiro file

- **WHEN** a command/prompt primitive is included in a kiro materialize set
- **THEN** no new file is created under `.kiro/` for that primitive

### Requirement: Configure project MCP with translate placeholders

When `.kiro/` exists, `configureMcp` MUST merge servers into `.kiro/settings/mcp.json` under `mcpServers`, translating APM `${env:VAR}` / `<VAR>` forms to runtime `${VAR}` and MUST declare `mcpEnvMode: "translate"`. When `.kiro/` is absent, configure MUST skip the write (opt-in) and return a diagnostic without creating `.kiro/`.

#### Scenario: Writes translated env placeholders

- **WHEN** configureMcp is invoked with a stdio server env value `${env:TOKEN}` and cwd has `.kiro/`
- **THEN** `.kiro/settings/mcp.json` contains that server with env value `${TOKEN}`

#### Scenario: Skips MCP when .kiro missing

- **WHEN** configureMcp is invoked and cwd has no `.kiro/` directory
- **THEN** no MCP config file is created and the report includes a skip diagnostic

### Requirement: Thin AGENTS.md compile

When `compile` is invoked for the kiro integration, it MUST emit cwd-relative `AGENTS.md` (default) with a generated header. Instruction primitives already deployed as steering MUST be omitted from the compiled body (thin agents-family compile).

#### Scenario: Compile writes AGENTS.md omitting steering instructions

- **WHEN** compile runs with write=true over a set that includes instruction and skill primitives
- **THEN** `AGENTS.md` is written and does not duplicate the instruction bodies already intended for `.kiro/steering/`
