# primitives-discovery Specification

## Purpose

Defines Consumer-facing primitives discovery and conflict resolution in `@b-apm/core`: source attribution, local override, first-declared dependency wins, and the M4 discovery floor for skills and typed `.apm/` content.

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

Discovery MUST recognize a package-root `SKILL.md` as one skill unit attributed to that package. Discovery MUST cover typed files under `.apm/` for skills, agents, instructions, prompts (as commands), and hooks. Discovery MUST also cover top-level `hooks/*.json` and package-root `*.prompt.md` for APM parity. Skill collections under `skills/<name>/SKILL.md` SHOULD be discovered when inexpensive. Full multi-host MCP install paths remain outside this discovery floor; portable Agent Plugins mapping is specified by `agent-plugins-compatibility`.

#### Scenario: Skill bundle discovered

- **WHEN** a package root contains `SKILL.md`
- **THEN** discovery MUST yield one skill unit attributed to that package

#### Scenario: Typed .apm skills agents instructions

- **WHEN** a package or project contains typed `.apm/` skills, agents, or instructions files
- **THEN** discovery MUST include those primitives in the attributed set

#### Scenario: Typed .apm prompts and hooks

- **WHEN** a package or project contains `.apm/prompts/*.prompt.md` or `.apm/hooks/*.json`
- **THEN** discovery MUST include corresponding `command` and `hook` primitives in the attributed set

### Requirement: Single-file dependency packages discover their primitive

When discovery receives a dependency package root that is a supported single primitive file (`.agent.md`, `.instructions.md`, `.prompt.md`), it MUST yield exactly one attributed primitive with `source: dependency:<filename>`, `packageName` equal to the source filename, and the suffix-selected type (`agent`, `instruction`, or `command`). Discovery MUST NOT require the file to be nested under `.apm/` for this case.

#### Scenario: Agent file package root

- **WHEN** a dependency package root is `scout.agent.md`
- **THEN** discovery MUST yield an `agent` primitive named `scout` attributed to `dependency:scout.agent.md`

#### Scenario: Instruction and prompt file package roots

- **WHEN** dependency package roots are `style.instructions.md` and `review.prompt.md`
- **THEN** discovery MUST yield an `instruction` named `style` and a `command` named `review` with matching dependency attribution

#### Scenario: Typed `.apm` suffix names are stripped

- **WHEN** discovery finds `.apm/agents/scout.agent.md` or `.apm/instructions/style.instructions.md`
- **THEN** the primitive names MUST be `scout` and `style` (the APM suffix is not part of the name)

### Requirement: Directory-backed skills expose their complete skill directory

When discovery finds a skill as `.apm/skills/<name>/SKILL.md` or `skills/<name>/SKILL.md`, the primitive MUST carry `skillDirectory` pointing at `<name>` so targets can materialize the complete skill unit (references, scripts, nested assets). A package-root `SKILL.md` MUST NOT carry `skillDirectory`, because its containing directory is the whole package; only that file is the skill unit.

#### Scenario: Typed .apm skill directory marked

- **WHEN** discovery finds `.apm/skills/foo/SKILL.md`
- **THEN** the `foo` skill primitive MUST include `skillDirectory` equal to `.apm/skills/foo`

#### Scenario: skills collection directory marked

- **WHEN** discovery finds `skills/foo/SKILL.md`
- **THEN** the `foo` skill primitive MUST include `skillDirectory` equal to `skills/foo`

#### Scenario: Package-root SKILL.md stays file-backed

- **WHEN** discovery finds `SKILL.md` at a package or project root
- **THEN** the resulting skill primitive MUST NOT include `skillDirectory`

### Requirement: Discovery covers commands from prompts

Discovery MUST recognize command primitives from `.apm/prompts/*.prompt.md` and package-root `*.prompt.md` files. Each such file MUST produce an attributed primitive with type `command`. Discovery MUST NOT require a separate `.apm/commands/` directory for APM-layout packages.

#### Scenario: .apm prompts discovered as commands

- **WHEN** a package or project contains typed `.apm/prompts/*.prompt.md`
- **THEN** discovery MUST include those units as `command` primitives in the attributed set

### Requirement: Discovery covers hooks JSON layouts

Discovery MUST recognize hook primitives from `.apm/hooks/*.json` and top-level `hooks/*.json`. Each such JSON file MUST produce an attributed primitive with type `hook`. Hook-only package trees that contain top-level `hooks/*.json` MUST still yield hook primitives.

#### Scenario: Typed .apm hooks discovered

- **WHEN** a package or project contains `.apm/hooks/*.json`
- **THEN** discovery MUST include those units as `hook` primitives in the attributed set

#### Scenario: Top-level hooks discovered

- **WHEN** a package contains top-level `hooks/*.json`
- **THEN** discovery MUST include those units as `hook` primitives
