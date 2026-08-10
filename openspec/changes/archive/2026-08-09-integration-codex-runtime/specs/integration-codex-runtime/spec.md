## Purpose

Defines Codex CLI project-scope runtime on `@b-apm/integration-codex`: detect `.codex/` only, materialize skills under `.agents/skills/` and agents/hooks under `.codex/`, configure MCP in `.codex/config.toml`, compile root `AGENTS.md` including instructions, while marketplace pack mapping remains available from the same package.

## ADDED Requirements

### Requirement: Package exposes runtime factory and retains marketplace mapper

`@b-apm/integration-codex` MUST continue to provide Codex marketplace-output mapping (including the documented default marketplace path `.agents/plugins/marketplace.json`) and MUST also export a runtime integration factory usable as `createIntegration` (and MAY export a Codex-named factory alias such as `createCodexIntegration`). The runtime integration MUST implement `BapmIntegration` (`id`, `deployRoots`, `detect`, `materialize`) and MUST depend on `@b-apm/integration-api` without requiring `@b-apm/core` as a hard dependency for host behavior. Package id for the runtime target MUST be `codex`.

#### Scenario: Runtime factory registers as codex

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `codex` and MUST expose `detect` and `materialize`

#### Scenario: Marketplace mapper remains available

- **WHEN** pack loads Codex marketplace-output capability from `@b-apm/integration-codex`
- **THEN** the Codex marketplace document mapping and default output path MUST still be available without requiring runtime activation

### Requirement: Detect uses .codex directory only

The Codex integration MUST return true from `detect` when a project-root `.codex/` directory exists. Detection MUST NOT treat a lone project-root `AGENTS.md` as a Codex signal. Detection MUST NOT create `.codex/` solely to opt into auto-detect.

#### Scenario: Detect uses .codex directory

- **WHEN** the project has a `.codex/` directory and codex is registered
- **THEN** codex `detect` MUST return true

#### Scenario: Lone AGENTS.md is not Codex

- **WHEN** the project has `AGENTS.md` at the project root and no `.codex/` directory
- **THEN** codex `detect` MUST return false

#### Scenario: Detect does not invent signals

- **WHEN** neither `.codex/` nor other Codex signals exist
- **THEN** codex `detect` MUST return false and MUST NOT create `.codex/`

### Requirement: Deploy roots cover .codex, .agents, and constrained root compile output

Registered default deploy roots for Codex MUST include `.codex` and `.agents`, and MUST cover project-root compile output (`AGENTS.md`) via an explicit root registration or equivalent containment rule. Materialize writes for skills MUST stay under `.agents/`; materialize writes for agents, hooks config, and hook scripts MUST stay under `.codex/`. Root-level writers MUST NOT write arbitrary paths under `.`.

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a path outside registered deploy roots
- **THEN** the write MUST fail closed (throw or equivalent hard failure) and MUST NOT create the escaped path

### Requirement: Skills materialize under .agents/skills

When Codex is active, skill primitives MUST materialize to `.agents/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory (dereferenced, contained under plugin root) into that destination. Skill materialize MUST NOT write `.codex/skills/` and MUST NOT write MCP config as a side effect.

#### Scenario: Skill appears under cross-tool skills root

- **WHEN** install runs with Codex registered and a dependency provides a skill
- **THEN** the skill MUST appear at `.agents/skills/<name>/SKILL.md` and MUST NOT be written under `.codex/skills/`

#### Scenario: Portable skill directory is fully copied

- **WHEN** install runs with Codex active and a portable Agent Plugins skill with auxiliary files under `skillDirectory`
- **THEN** those auxiliary files MUST be present under `.agents/skills/<name>/` after materialize

### Requirement: Agents materialize as Codex TOML and drop tools frontmatter

Agent primitives MUST materialize to `.codex/agents/<name>.toml`. Portable agent markdown frontmatter `name` and `description` MUST map to TOML keys; the markdown body MUST map to `developer_instructions`. Frontmatter `tools` MUST be dropped and MUST surface a lossy diagnostic. Agent materialize MUST NOT write MCP config as a side effect.

#### Scenario: Agent becomes Codex agent TOML

- **WHEN** Codex materialize runs with an agent primitive
- **THEN** a file MUST exist at `.codex/agents/<name>.toml` containing `name`, `description`, and `developer_instructions` derived from the source

#### Scenario: Tools frontmatter is dropped with diagnostic

- **WHEN** an agent primitive includes `tools` in frontmatter
- **THEN** the written TOML MUST omit `tools` and materialize MUST report a diagnostic for the drop

### Requirement: Unsupported primitives skip native files

Instruction, command, and prompt primitives MUST NOT write Codex-native host files during materialize. The integration MUST keep install non-fatal for those kinds and MAY emit non-fatal diagnostics identifying the skipped kind. Instruction content remains eligible for host `compile` output.

#### Scenario: Instruction does not write a rules file

- **WHEN** Codex materialize runs with an instruction primitive
- **THEN** no Codex-native instruction/rules file MUST be created for that primitive under `.codex/`

#### Scenario: Command does not write a commands file

- **WHEN** Codex materialize runs with a command primitive
- **THEN** no Codex-native commands file MUST be created for that primitive

### Requirement: Hooks merge into hooks.json with ownership sidecar

Hook primitives MUST merge into `.codex/hooks.json` under the native hooks structure Codex expects, copying referenced scripts under `.codex/hooks/<name>/` as needed. The package MUST maintain a project sidecar at `.codex/bapm-hooks.json` recording bapm-owned hook entries/scripts so reinstall can remove previously owned entries before re-merge. Native `hooks.json` MUST preserve unrelated top-level keys and non-owned hook handlers. Ownership metadata MUST NOT be left as Codex-native private keys inside handler objects in `hooks.json`.

#### Scenario: Hooks merge into hooks.json

- **WHEN** Codex materialize runs with a valid hook primitive JSON
- **THEN** `.codex/hooks.json` MUST contain the merged hook handlers and unrelated existing keys MUST remain intact

#### Scenario: Reinstall replaces owned hooks only

- **WHEN** Codex materialize runs again after a prior owned hooks deploy
- **THEN** previously bapm-owned hook entries MUST be replaced according to the sidecar and non-owned handlers MUST remain

### Requirement: Active Codex invocation may create .codex for hooks and MCP

When Codex materialize or `configureMcp` is actively invoked for the Codex target (including forced `--target codex`), writers MUST be allowed to create `.codex/` directories as needed so hooks and MCP are not skipped solely because the directory was absent. Auto-detect without an existing `.codex/` MUST still return false and MUST NOT mkdir solely to opt into detect.

#### Scenario: Forced codex creates roots for hooks

- **WHEN** install runs with forced target `codex` registered, no `.codex/` directory present, and hook primitives are deployed
- **THEN** `.codex/hooks.json` (and needed parents) MUST be creatable and hooks MUST NOT be skipped solely for missing directory

#### Scenario: Detect still requires existing .codex

- **WHEN** `.codex/` is absent and no forced write path is running
- **THEN** codex `detect` MUST return false and MUST NOT create `.codex/`

### Requirement: Project MCP configure writes mcp_servers in config.toml

Codex MUST expose optional `configureMcp`. For project scope it MUST create or update `.codex/config.toml` under the `mcp_servers` table, merging owned server entries by name while preserving unrelated servers and unrelated top-level tables. Stdio-shaped servers and https streamable-http remotes MUST be supported. SSE remotes MUST be rejected with a per-server diagnostic and MUST NOT be written. When existing `config.toml` cannot be parsed safely, configure MUST skip write with a diagnostic and MUST NOT clobber the file. Writes MUST NOT target user-scope `CODEX_HOME` / `~/.codex` paths. Reports MUST include config/deployed paths suitable for lock inventory.

#### Scenario: Configure writes mcp_servers

- **WHEN** Codex `configureMcp` runs with an eligible stdio server
- **THEN** `.codex/config.toml` MUST contain that server under `mcp_servers`

#### Scenario: SSE remote is rejected

- **WHEN** configure receives a server marked as SSE transport/type
- **THEN** that server MUST NOT be written and a diagnostic MUST be reported for it

#### Scenario: Malformed TOML is not clobbered

- **WHEN** `.codex/config.toml` exists but cannot be parsed as TOML
- **THEN** configure MUST NOT overwrite the file and MUST emit a skip/diagnostic outcome

#### Scenario: Existing unrelated MCP servers are preserved

- **WHEN** `config.toml` already contains other `mcp_servers` entries and configure writes a new owned server
- **THEN** unrelated server names MUST remain intact

### Requirement: Compile emits AGENTS.md including instructions

Codex runtime MUST expose `compile` that renders project-root `AGENTS.md` by default (overridable via compile output path context). Instruction primitives MUST be included in the compiled body (compile-only guidance path). Emit MUST be deterministic for unchanged inputs. When compile write intent is false, content MUST still be returned without durable write.

#### Scenario: Compile writes AGENTS.md

- **WHEN** Codex `compile` runs with write intent true and discoverable primitives
- **THEN** `AGENTS.md` MUST be written at the project root (or the provided relative output path) with deterministic content

#### Scenario: Instructions included in AGENTS.md body

- **WHEN** Codex `compile` receives instruction primitives alongside other kinds
- **THEN** the compiled `AGENTS.md` body MUST include those instruction primitives

#### Scenario: Validate/preview does not write

- **WHEN** Codex `compile` runs with write intent false
- **THEN** the report MUST include rendered content and path and MUST NOT create or rewrite the output file

### Requirement: Not imported by core

`@b-apm/core` MUST NOT hard-depend on or statically import `@b-apm/integration-codex` for Codex runtime behavior. Registration MUST occur through the integration API registry after object-map / dynamic load (or test harness registration).

#### Scenario: Core package graph excludes codex runtime hard-dep

- **WHEN** inspecting `@b-apm/core` production dependencies
- **THEN** `@b-apm/integration-codex` MUST NOT appear as a required runtime dependency of core
