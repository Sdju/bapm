# integration-windsurf-runtime Specification

## Purpose

Defines the greenfield `@b-apm/integration-windsurf` package: Windsurf project-scope detect, materialize under `.windsurf/` and `.agents/`, skip agents, and home-scoped MCP bake configure with Copilot-client-adapter JSON parity, depending only on `@b-apm/integration-api`.

## Requirements

### Requirement: Package @b-apm/integration-windsurf exists and depends only on integration API

The monorepo MUST include package directory `packages/integration-windsurf` with package name `@b-apm/integration-windsurf`. The package MUST be TypeScript ESM with vite-plus tooling consistent with other `@b-apm/integration-*` packages. Among bapm packages it MUST depend on `@b-apm/integration-api` for types and contracts and MUST NOT require `@b-apm/core` as a hard dependency for host capability implementation. The package MUST export a runtime factory usable as `createIntegration` and MAY export `createWindsurfIntegration` as an alias. Runtime integration `id` MUST be `windsurf`. The package MUST NOT expose a marketplace-output mapper in this capability.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the Windsurf package dependencies
- **THEN** `@b-apm/integration-windsurf` depends on `@b-apm/integration-api` and does not reverse-depend on `@b-apm/core` for its host behavior

#### Scenario: Runtime factory registers as windsurf

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `windsurf` and MUST expose `detect` and `materialize`

### Requirement: Detect uses .windsurf directory signal

The Windsurf integration MUST return true from `detect` when the project-root directory `.windsurf/` exists. Detection MUST return false when that directory is absent. Detection MUST NOT create `.windsurf/` solely to opt into auto-detect.

#### Scenario: .windsurf directory activates detect

- **WHEN** the project has a `.windsurf/` directory and Windsurf is registered
- **THEN** windsurf `detect` MUST return true

#### Scenario: Empty project is not Windsurf

- **WHEN** `.windsurf/` does not exist under the project
- **THEN** windsurf `detect` MUST return false and MUST NOT create `.windsurf/` or `.agents/` solely for detection

### Requirement: Deploy roots cover .windsurf and .agents

Registered default deploy roots for Windsurf MUST include `.windsurf` and `.agents`. Materialize writes for instructions, commands/workflows, and hooks MUST stay under `.windsurf/`. Materialize writes for skills MUST stay under `.agents/`. Writes MUST NEVER escape registered deploy roots for project-scope materialize. Home-scoped MCP configure is exempt from project deploy-root assertion.

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a project path outside registered deploy roots
- **THEN** the write MUST fail closed and MUST NOT create the escaped path

### Requirement: Instructions materialize under .windsurf/rules

Instruction primitives MUST materialize to `.windsurf/rules/<name>.md` under registered deploy roots. Windsurf-relevant frontmatter (such as `trigger` / `globs`) MUST be preserved when present in the source. Instruction materialize MUST NOT write MCP config as a side effect.

#### Scenario: Instruction becomes windsurf rules file

- **WHEN** Windsurf materialize runs with an instruction primitive
- **THEN** a file MUST exist at `.windsurf/rules/<name>.md`

### Requirement: Commands materialize as Windsurf workflows

When the conflict-resolved primitive set contains `command` primitives, Windsurf materialize MUST write `.windsurf/workflows/<name>.md` and MUST NOT write under `.windsurf/commands/` or Cursor-style commands paths.

#### Scenario: Command lands under workflows

- **WHEN** Windsurf materialize runs with a `command` primitive
- **THEN** the file MUST appear at `.windsurf/workflows/<name>.md` and MUST NOT appear under `.windsurf/commands/`

### Requirement: Skills materialize under .agents/skills

Skill primitives MUST materialize to `.agents/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory into that destination. Skill materialize MUST NOT write `.windsurf/skills/` and MUST NOT write MCP config as a side effect.

#### Scenario: Skill appears under cross-tool skills root

- **WHEN** install runs with Windsurf registered and a dependency provides a skill
- **THEN** the skill MUST appear at `.agents/skills/<name>/SKILL.md` and MUST NOT be written under `.windsurf/skills/`

#### Scenario: Portable skill directory is fully copied

- **WHEN** install runs with Windsurf active and a portable Agent Plugins skill with auxiliary files under `skillDirectory`
- **THEN** those auxiliary files MUST be present under `.agents/skills/<name>/` after materialize

### Requirement: Agents are not materialized

Windsurf runtime MUST NOT materialize agent primitives to `.windsurf/agents/` or any other agents tree. When agent primitives are present in the attributed set, materialize MUST skip them with a non-fatal diagnostic and MUST continue materializing supported kinds.

#### Scenario: Agent primitive is skipped

- **WHEN** Windsurf materialize runs with an agent primitive
- **THEN** no agents destination file MUST be created for that primitive and a diagnostic MUST report that agents are unsupported for Windsurf

### Requirement: Hooks merge into .windsurf/hooks.json with PascalCase and ownership

Hook primitives MUST merge into `.windsurf/hooks.json` under the `hooks` key with referenced scripts copied under `.windsurf/hooks/<name>/` (or an equivalent documented scripts subtree under `.windsurf/hooks/`). Event names written for Windsurf MUST be normalized to PascalCase. The package MUST maintain a project sidecar at `.windsurf/bapm-hooks.json` listing bapm-owned hook commands/scripts so reinstall can remove previously owned artifacts before rewrite. Ownership metadata MUST NOT be embedded as Windsurf-private keys inside the host hooks JSON. Reinstall MUST be idempotent for owned hooks. Unrelated user hook entries MUST be preserved.

#### Scenario: Hook merges with PascalCase event

- **WHEN** Windsurf materialize runs with a valid hook primitive whose source uses a non-PascalCase event name
- **THEN** `.windsurf/hooks.json` MUST contain the entry under a PascalCase event key

#### Scenario: Reinstall replaces owned hooks only

- **WHEN** Windsurf materialize runs again after a prior owned hooks deploy
- **THEN** previously bapm-owned hook entries/scripts listed in the sidecar MUST be replaceable/removable and unrelated user hook entries MUST remain

### Requirement: Active Windsurf invocation may create project deploy roots

When Windsurf materialize is actively invoked for the Windsurf target (including forced `--target windsurf`), writers MUST be allowed to create `.windsurf/` and `.agents/` directories as needed. Auto-detect without `.windsurf/` MUST still return false and MUST NOT mkdir solely to opt into detect.

#### Scenario: Forced windsurf creates roots

- **WHEN** install runs with forced target `windsurf` registered and no `.windsurf/` present
- **THEN** materialize MAY create registered deploy roots and write primitives under them

### Requirement: Home MCP configure with client-adapter parity (bake)

When install invokes Windsurf `configureMcp` with an eligible server set, `@b-apm/integration-windsurf` MUST create or update the user-home file `~/.codeium/windsurf/mcp_config.json` (resolved via `CODEIUM_HOME` when set as `<CODEIUM_HOME>/windsurf/mcp_config.json`, otherwise default home `.codeium/windsurf`) under the top-level `mcpServers` object keyed by server name. The JSON shape MUST match Copilot-client-adapter parity (`command`/`args`/`env`/`url` as applicable). The integration MUST NOT set `mcpEnvMode: "translate"` (install bake remains the default). Writes MUST preserve unrelated `mcpServers` names and unrelated top-level keys, MUST be idempotent overwrites of owned server keys, and MUST report a non-empty configuration path for lock inventory. This capability MUST NOT write project-scoped Windsurf MCP files.

#### Scenario: Configure writes mcpServers in home mcp_config.json

- **WHEN** Windsurf configureMcp is invoked with a stdio server definition
- **THEN** `~/.codeium/windsurf/mcp_config.json` MUST contain that server under `mcpServers`

#### Scenario: Existing unrelated servers are preserved

- **WHEN** `~/.codeium/windsurf/mcp_config.json` already contains other `mcpServers` entries and configureMcp writes a new owned server
- **THEN** unrelated server names MUST remain intact

### Requirement: User-scope and global_rules stay out of this runtime

Windsurf runtime in this capability MUST NOT deploy user-scope file primitives under `~/.codeium/windsurf/` (other than the documented MCP config path) and MUST NOT write `memories/global_rules.md` or otherwise mutate global rules.

#### Scenario: global_rules is not written by materialize

- **WHEN** Windsurf materialize runs for supported primitive kinds
- **THEN** `memories/global_rules.md` under the Codeium Windsurf home MUST NOT be created as a materialize side effect

### Requirement: Not imported by core

`@b-apm/core` MUST NOT hard-depend on `@b-apm/integration-windsurf`. Windsurf remains an opt-in host package loaded via object-map / dynamic import.

#### Scenario: Core package.json omits windsurf integration

- **WHEN** inspecting `@b-apm/core` dependencies
- **THEN** `@b-apm/integration-windsurf` is not a required dependency of core
