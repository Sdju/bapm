# primitives-discovery Specification

## Purpose

Defines Consumer-facing primitives discovery and conflict resolution in `@bapm/core`: source attribution, local override, first-declared dependency wins, and the M4 discovery floor for skills and typed `.apm/` content.

## Requirements

### Requirement: Every discovered primitive has source attribution
Discovery MUST attribute each primitive as either `local` or `dependency:<name>` (OpenAPM pr-001). Local project primitives under project `.apm/` (and documented local patterns) MUST use `local`. Primitives found under a dependency package tree MUST use `dependency:<package-name>`.

#### Scenario: Local attribution
- **WHEN** discovery finds a project skill such as `.apm/skills/foo/SKILL.md` (or an equivalent typed skill file)
- **THEN** the primitive source MUST be `local`

#### Scenario: Dependency attribution
- **WHEN** discovery finds a primitive under a dependency package in the modules directory
- **THEN** the primitive source MUST be `dependency:<name>` for that package

### Requirement: Local overrides same name and type from dependencies
When a local primitive and a dependency primitive share the same name and type, the local primitive MUST win and a diagnostic MUST be inspectable (OpenAPM pr-002).

#### Scenario: Local wins over dependency
- **WHEN** the same primitive name and type exist in local project content and in a dependency
- **THEN** conflict resolution MUST keep the local primitive and MUST expose an inspectable diagnostic

### Requirement: First-declared dependency wins among dependencies
Among dependency-sourced primitives with the same name and type, declaration order MUST decide the winner: the first-declared dependency wins and later ones MUST NOT replace it (OpenAPM pr-003).

#### Scenario: First-declared dep wins
- **WHEN** two dependencies A then B declare the same primitive name and type
- **THEN** conflict resolution MUST keep A's primitive and MUST NOT let B replace it

### Requirement: Skill bundle and typed package layout floor
Discovery MUST recognize a package-root `SKILL.md` as one skill unit attributed to that package. Discovery MUST cover at least typed files under `.apm/` for skills, agents, and instructions. Skill collections under `skills/<name>/SKILL.md` SHOULD be discovered when inexpensive. Full plugin collection and MCP server install paths are out of M4.

#### Scenario: Skill bundle discovered
- **WHEN** a package root contains `SKILL.md`
- **THEN** discovery MUST yield one skill unit attributed to that package

#### Scenario: Typed .apm skills agents instructions
- **WHEN** a package or project contains typed `.apm/` skills, agents, or instructions files
- **THEN** discovery MUST include those primitives in the attributed set for M4
