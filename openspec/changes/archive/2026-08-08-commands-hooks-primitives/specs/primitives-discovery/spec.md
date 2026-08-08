## ADDED Requirements

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

## MODIFIED Requirements

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
