## Purpose

Defines Grok Build project-scope runtime on `@b-apm/integration-grok-build`: detect `.grok/` only, materialize instructions/agents/commands/skills under `.grok/`, skip hooks/prompts and MCP, and compile project-root `AGENTS.md`.

## Requirements

### Requirement: Package exposes grok-build runtime factory

`@b-apm/integration-grok-build` MUST export a runtime integration factory usable as `createIntegration` (and MAY export a named alias such as `createGrokBuildIntegration`). The runtime integration MUST implement `BapmIntegration` (`id`, `deployRoots`, `detect`, `materialize`) and MUST depend on `@b-apm/integration-api` without requiring `@b-apm/core` as a hard dependency for host behavior. Package id for the runtime target MUST be `grok-build`. The integration MUST NOT expose `configureMcp` (APM matrix: MCP unsupported for grok-build).

#### Scenario: Runtime factory registers as grok-build

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `grok-build`, MUST expose `detect` and `materialize`, and MUST NOT expose `configureMcp`

### Requirement: Detect uses .grok directory only

The Grok Build integration MUST return true from `detect` when a project-root `.grok/` directory exists. Detection MUST NOT treat a lone project-root `AGENTS.md` as a Grok Build signal. Detection MUST NOT create `.grok/` solely to opt into auto-detect.

#### Scenario: Detect uses .grok directory

- **WHEN** the project has a `.grok/` directory and grok-build is registered
- **THEN** grok-build `detect` MUST return true

#### Scenario: Lone AGENTS.md is not grok-build

- **WHEN** the project has `AGENTS.md` at the project root and no `.grok/` directory
- **THEN** grok-build `detect` MUST return false

#### Scenario: Detect does not invent signals

- **WHEN** neither `.grok/` nor other Grok Build signals exist
- **THEN** grok-build `detect` MUST return false and MUST NOT create `.grok/`

### Requirement: Deploy roots cover .grok and constrained root compile output

Registered default deploy roots for Grok Build MUST include `.grok` and MUST cover project-root compile output (`AGENTS.md`) via an explicit root registration or equivalent containment rule. Materialize writes MUST stay under `.grok/`. Root-level writers MUST NOT write arbitrary paths under `.`.

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a path outside registered deploy roots
- **THEN** the write MUST fail closed (throw or equivalent hard failure) and MUST NOT create the escaped path

### Requirement: Skills materialize under .grok/skills

When Grok Build is active, skill primitives MUST materialize to `.grok/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory (dereferenced, contained under plugin root) into that destination. Skill materialize MUST NOT write `.agents/skills/` and MUST NOT write MCP config as a side effect.

#### Scenario: Skill appears under grok skills root

- **WHEN** install runs with Grok Build registered and a dependency provides a skill
- **THEN** the skill MUST appear at `.grok/skills/<name>/SKILL.md` and MUST NOT be written under `.agents/skills/`

#### Scenario: Portable skill directory is fully copied

- **WHEN** install runs with Grok Build active and a portable Agent Plugins skill with auxiliary files under `skillDirectory`
- **THEN** those auxiliary files MUST be present under `.grok/skills/<name>/` after materialize

### Requirement: Instructions materialize as .grok/rules markdown

Instruction primitives MUST materialize to `.grok/rules/<name>.md`. Content MUST be written as markdown under that path (APM `grok_rules` identity transform: no required frontmatter remapping). Instruction materialize MUST NOT write MCP config as a side effect.

#### Scenario: Instruction becomes grok rules file

- **WHEN** Grok Build materialize runs with an instruction primitive
- **THEN** a file MUST exist at `.grok/rules/<name>.md` containing the instruction content

### Requirement: Agents materialize as .grok/agents markdown

Agent primitives MUST materialize to `.grok/agents/<name>.md`. Agent materialize MUST NOT write MCP config as a side effect.

#### Scenario: Agent becomes grok agent markdown

- **WHEN** Grok Build materialize runs with an agent primitive
- **THEN** a file MUST exist at `.grok/agents/<name>.md` containing the agent content

### Requirement: Commands materialize as .grok/commands with shared frontmatter subset

Command primitives MUST materialize to `.grok/commands/<name>.md`. Frontmatter MUST preserve the shared Claude-command subset (`description`, `allowed-tools`, `model`, `argument-hint`, `input`) and MUST drop other frontmatter keys with a non-fatal diagnostic. Command materialize MUST NOT write MCP config as a side effect.

#### Scenario: Command becomes grok command markdown

- **WHEN** Grok Build materialize runs with a command primitive
- **THEN** a file MUST exist at `.grok/commands/<name>.md`

#### Scenario: Non-preserved command frontmatter is dropped with diagnostic

- **WHEN** a command primitive includes frontmatter keys outside the preserved subset
- **THEN** those keys MUST be omitted from the written file and materialize MUST report a diagnostic for the drop

### Requirement: Hooks and prompts skip native files

Hook and prompt primitives MUST NOT write Grok Build-native host files during materialize. The integration MUST keep install non-fatal for those kinds and MUST emit non-fatal diagnostics identifying the skipped kind. The integration MUST NOT invent hooks JSON, prompt directories, or MCP config writers for this host.

#### Scenario: Hook does not write host hooks config

- **WHEN** Grok Build materialize runs with a hook primitive
- **THEN** no Grok Build hooks config/scripts MUST be created for that primitive under `.grok/` and a skip diagnostic MUST be reported

#### Scenario: Prompt does not write host prompt files

- **WHEN** Grok Build materialize runs with a prompt primitive
- **THEN** no Grok Build prompt file MUST be created for that primitive and a skip diagnostic MUST be reported

### Requirement: Active grok-build invocation may create .grok for materialize

When Grok Build materialize is actively invoked for the grok-build target (including forced `--target grok-build`), writers MUST be allowed to create `.grok/` directories as needed so primitives are not skipped solely because the directory was absent. Auto-detect without an existing `.grok/` MUST still return false and MUST NOT mkdir solely to opt into detect.

#### Scenario: Forced grok-build creates roots for materialize

- **WHEN** install runs with forced target `grok-build` registered, no `.grok/` directory present, and skill/instruction primitives are deployed
- **THEN** `.grok/` (and needed parents) MUST be creatable and writes MUST NOT be skipped solely for missing directory

#### Scenario: Detect still requires existing .grok

- **WHEN** `.grok/` is absent and no forced write path is running
- **THEN** grok-build `detect` MUST return false and MUST NOT create `.grok/`

### Requirement: Compile emits AGENTS.md

Grok Build runtime MUST expose `compile` that renders project-root `AGENTS.md` by default (overridable via compile output path context). Emit MUST be deterministic for unchanged inputs. When compile write intent is false, content MUST still be returned without durable write. Compile MUST NOT invent MCP or hooks side effects.

#### Scenario: Compile writes AGENTS.md

- **WHEN** Grok Build `compile` runs with write intent true and discoverable primitives
- **THEN** `AGENTS.md` MUST be written at the project root (or the provided relative output path) with deterministic content

#### Scenario: Validate/preview does not write

- **WHEN** Grok Build `compile` runs with write intent false
- **THEN** the report MUST include compiled content and MUST NOT create or rewrite the output file
