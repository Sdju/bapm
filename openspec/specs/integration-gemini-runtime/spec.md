# integration-gemini-runtime Specification

## Purpose

Defines the greenfield `@b-apm/integration-gemini` package: Gemini CLI project-scope detect, materialize of commands/skills/hooks, MCP configure into `.gemini/settings.json`, and thin instruction-only compile to `GEMINI.md`, depending only on `@b-apm/integration-api` among bapm packages.

## Requirements

### Requirement: Package @b-apm/integration-gemini exists and depends only on integration API

The monorepo MUST include package directory `packages/integration-gemini` with package name `@b-apm/integration-gemini`. The package MUST be TypeScript ESM with vite-plus tooling consistent with other `@b-apm/integration-*` packages. Among bapm packages it MUST depend on `@b-apm/integration-api` for types and contracts and MUST NOT require `@b-apm/core` as a hard dependency for host capability implementation. The package MUST export a runtime factory usable as `createIntegration` and MAY export `createGeminiIntegration` as an alias. Runtime integration `id` MUST be `gemini`. The package MUST NOT expose a marketplace-output mapper in this capability.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the Gemini package dependencies
- **THEN** `@b-apm/integration-gemini` depends on `@b-apm/integration-api` and does not reverse-depend on `@b-apm/core` for its host behavior

#### Scenario: Runtime factory registers as gemini

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `gemini` and MUST expose `detect` and `materialize`

### Requirement: Detect uses .gemini directory or GEMINI.md

The Gemini integration MUST return true from `detect` when either project-root directory `.gemini/` exists or project-root file `GEMINI.md` exists. Detection MUST return false for an empty project with neither signal. Detection MUST NOT create those paths solely to opt into auto-detect.

#### Scenario: .gemini directory activates detect

- **WHEN** the project has a `.gemini/` directory and Gemini is registered
- **THEN** gemini `detect` MUST return true

#### Scenario: GEMINI.md file activates detect

- **WHEN** the project has a project-root `GEMINI.md` file and no `.gemini/` directory
- **THEN** gemini `detect` MUST return true

#### Scenario: Empty project is not Gemini

- **WHEN** neither `.gemini/` nor `GEMINI.md` exists under the project
- **THEN** gemini `detect` MUST return false and MUST NOT create `.gemini/` or `GEMINI.md` solely for detection

### Requirement: Deploy roots cover .gemini, .agents, and project root

Registered default deploy roots for Gemini MUST include `.gemini`, `.agents`, and `.`. Materialize writes for commands and hooks MUST stay under `.gemini/`. Materialize writes for skills MUST stay under `.agents/`. Compile MAY write project-root `GEMINI.md` under the `.` deploy root. Writes MUST NEVER escape registered deploy roots for project-scope materialize.

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a project path outside registered deploy roots
- **THEN** the write MUST fail closed and MUST NOT create the escaped path

### Requirement: Commands materialize as Gemini TOML under .gemini/commands

Command primitives (including sources discovered as `*.prompt.md`) MUST materialize to `.gemini/commands/<name>.toml` under registered deploy roots. The TOML MUST include a `prompt` field from the markdown body with `$ARGUMENTS` rewritten to `{{args}}`, and MAY include `description` from frontmatter when present. Command materialize MUST NOT write MCP config as a side effect.

#### Scenario: Command becomes gemini commands toml

- **WHEN** Gemini materialize runs with a command primitive whose body contains `$ARGUMENTS`
- **THEN** a file MUST exist at `.gemini/commands/<name>.toml` whose `prompt` uses `{{args}}` instead of `$ARGUMENTS`

### Requirement: Skills materialize under .agents/skills

Skill primitives MUST materialize to `.agents/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory into that destination. Skill materialize MUST NOT write `.gemini/skills/` and MUST NOT write MCP config as a side effect.

#### Scenario: Skill appears under cross-tool skills root

- **WHEN** install runs with Gemini registered and a dependency provides a skill
- **THEN** the skill MUST appear at `.agents/skills/<name>/SKILL.md` and MUST NOT be written under `.gemini/skills/`

### Requirement: Instructions are compile-only and not materialized

Instruction primitives MUST NOT be written as per-file rules under `.gemini/`. Materialize MUST emit a non-fatal diagnostic that instructions are compile-only. Instruction content MUST be available to `compile` for `GEMINI.md`.

#### Scenario: Instruction materialize skips host files

- **WHEN** Gemini materialize runs with an instruction primitive
- **THEN** no instruction file MUST be created under `.gemini/` and a non-fatal diagnostic MUST be reported

### Requirement: Hooks merge into .gemini/settings.json with ownership

Hook primitives MUST merge into `.gemini/settings.json` under a top-level `hooks` object, with referenced scripts under `.gemini/hooks/`. Known portable/Claude event names MUST be remapped for Gemini (`PreToolUse`/`preToolUse` → `BeforeTool`, `PostToolUse`/`postToolUse` → `AfterTool`, `Stop` → `SessionEnd`). The package MUST maintain a project sidecar at `.gemini/bapm-hooks.json` listing bapm-owned hook entries and script paths so reinstall can remove previously owned artifacts before rewrite. Ownership metadata MUST NOT be embedded as Gemini-private keys inside host hook payloads. Reinstall MUST be idempotent for owned hooks. Unrelated top-level keys in `settings.json` (including `mcpServers`) MUST be preserved.

#### Scenario: Hook merges into settings.json with Gemini event names

- **WHEN** Gemini materialize runs with a valid hook primitive using a `PreToolUse` event
- **THEN** `.gemini/settings.json` MUST contain the hook under event key `BeforeTool` and `.gemini/bapm-hooks.json` MUST list ownership

#### Scenario: Reinstall replaces owned hooks only

- **WHEN** Gemini materialize runs again after a prior owned hooks deploy
- **THEN** previously bapm-owned hook entries/scripts listed in the sidecar MUST be replaceable/removable and unrelated user content under `.gemini/settings.json` MUST remain

### Requirement: Active Gemini invocation may create project deploy roots

When Gemini materialize is actively invoked for the Gemini target (including forced `--target gemini`), writers MUST be allowed to create `.gemini/` and `.agents/` directories as needed. Auto-detect without `.gemini/` or `GEMINI.md` MUST still return false and MUST NOT mkdir solely to opt into detect.

#### Scenario: Forced gemini creates roots

- **WHEN** install runs with forced target `gemini` registered and no detect signals present
- **THEN** materialize MAY create registered deploy roots and write primitives under them

### Requirement: Project MCP configure into .gemini/settings.json mcpServers

When install invokes Gemini `configureMcp` with an eligible server set and project `.gemini/` exists, `@b-apm/integration-gemini` MUST create or update `.gemini/settings.json` under the top-level `mcpServers` object keyed by server name. Gemini entries MUST NOT require a Copilot-style `type` field; stdio uses `command`/`args`/`env`, SSE uses `url`, HTTP/streamable-http uses `httpUrl`. Writes MUST preserve unrelated `mcpServers` names and unrelated top-level keys (including `hooks`), MUST be idempotent overwrites of owned server keys, and MUST report a non-empty configuration path for lock inventory. When `.gemini/` is absent, configure MUST skip the write with a non-fatal diagnostic (opt-in) and MUST NOT create `.gemini/` solely for MCP.

#### Scenario: Configure writes mcpServers when .gemini exists

- **WHEN** Gemini configureMcp is invoked with a stdio server definition and `.gemini/` exists
- **THEN** `.gemini/settings.json` MUST contain that server under `mcpServers` without a required `type` field

#### Scenario: Configure skips when .gemini absent

- **WHEN** Gemini configureMcp is invoked and `.gemini/` does not exist
- **THEN** configure MUST NOT create `.gemini/settings.json` and MUST report a skip diagnostic

#### Scenario: Existing unrelated servers and hooks are preserved

- **WHEN** `.gemini/settings.json` already contains other `mcpServers` entries and/or `hooks` and configureMcp writes a new owned server
- **THEN** unrelated server names and `hooks` MUST remain intact

### Requirement: Thin compile emits GEMINI.md with instructions only

When Gemini exposes `compile` and compile is invoked for that target, the emitter MUST produce project-root `GEMINI.md` (or the compile output path supplied for that target), honor write vs validate/preview intent, and order instruction primitives deterministically. Non-instruction primitives MUST be omitted from the compile body. Compile MUST NOT implement rich APM distributed placement, user-scope `~/.gemini/GEMINI.md`, or a stub that only imports `AGENTS.md`.

#### Scenario: Compile writes GEMINI.md with instructions

- **WHEN** compile runs with Gemini active, write intent true, and instruction primitives are present
- **THEN** `GEMINI.md` MUST be written and the report MUST reflect wrote=true and include those instruction contents

#### Scenario: Non-instructions are omitted from compile body

- **WHEN** compile receives skill or command primitives alongside instructions
- **THEN** the compile body MUST include instruction content and MUST NOT duplicate skill/command bodies as compile sections

### Requirement: Unsupported surfaces stay out of this runtime

Gemini runtime in this capability MUST NOT write user-scope paths under `~/.gemini/`, MUST NOT implement rich distributed multi-file compile trees, and MUST NOT expose a marketplace mapper.

#### Scenario: User-scope paths are not created by materialize

- **WHEN** Gemini materialize runs for supported primitive kinds
- **THEN** materialize MUST NOT create files under the user home `.gemini/` directory as a side effect

### Requirement: Not imported by core

`@b-apm/core` MUST NOT hard-depend on or statically import `@b-apm/integration-gemini`. Registration for CLI or e2e MUST occur through the integration API registry after object-map load (or an equivalent test harness registration).

#### Scenario: Core package graph excludes gemini

- **WHEN** inspecting `@b-apm/core` dependencies
- **THEN** `@b-apm/integration-gemini` MUST NOT appear as a dependency
