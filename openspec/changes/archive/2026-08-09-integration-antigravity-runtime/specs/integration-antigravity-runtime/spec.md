## Purpose

Defines the greenfield `@bapm/integration-antigravity` package: explicit-only Antigravity CLI project-scope runtime under `.agents/` (rules, skills, hooks, opt-in MCP), thin `AGENTS.md` compile with rules dedup, depending only on `@bapm/integration-api`.

## ADDED Requirements

### Requirement: Package @bapm/integration-antigravity exists and depends only on integration API

The monorepo MUST include package directory `packages/integration-antigravity` with package name `@bapm/integration-antigravity`. The package MUST be TypeScript ESM with vite-plus tooling consistent with other `@bapm/integration-*` packages. Among bapm packages it MUST depend on `@bapm/integration-api` for types and contracts and MUST NOT require `@bapm/core` as a hard dependency for host capability implementation. The package MUST export a runtime factory usable as `createIntegration` and MAY export `createAntigravityIntegration` as an alias. Runtime integration `id` MUST be `antigravity`. The package MUST NOT expose a marketplace-output mapper in this capability.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the Antigravity package dependencies
- **THEN** `@bapm/integration-antigravity` depends on `@bapm/integration-api` and does not reverse-depend on `@bapm/core` for its host behavior

#### Scenario: Runtime factory registers as antigravity

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `antigravity` and MUST expose `detect` and `materialize`

### Requirement: Detect is always false (explicit-only)

The Antigravity integration `detect` predicate MUST always return false, including when project-root `.agents/` exists as a directory. Detection MUST NOT create `.agents/` or any Antigravity paths solely to opt into auto-detect. Activation MUST require explicit forced target / object-map selection (for example `--target antigravity`).

#### Scenario: Shared .agents directory does not auto-detect

- **WHEN** the project has a `.agents/` directory and Antigravity is registered
- **THEN** antigravity `detect` MUST return false

#### Scenario: Empty project does not auto-detect

- **WHEN** no `.agents/` directory exists under the project
- **THEN** antigravity `detect` MUST return false and MUST NOT create `.agents/` solely for detection

### Requirement: Deploy roots cover .agents and project-root compile

Registered default deploy roots for Antigravity MUST include `.agents` and MUST cover project-root compile output (`AGENTS.md`) via an explicit root registration or equivalent containment rule. Materialize writes for instructions (rules), skills, hooks config, hook scripts, and project MCP MUST stay under `.agents/`. Writes MUST NEVER escape registered deploy roots for project-scope materialize. This capability MUST NOT write user-home `~/.gemini/**` paths.

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a project path outside registered deploy roots
- **THEN** the write MUST fail closed and MUST NOT create the escaped path

### Requirement: Instructions materialize under .agents/rules with trigger/globs

Instruction primitives MUST materialize to `.agents/rules/<name>.md` under registered deploy roots. Portable `applyTo` frontmatter MUST map to Antigravity rule frontmatter `trigger: glob` and `globs` (single string or list for multi-glob). Instruction materialize MUST NOT write MCP config as a side effect.

#### Scenario: Instruction becomes agents rules file with globs

- **WHEN** Antigravity materialize runs with an instruction primitive that has `applyTo`
- **THEN** a file MUST exist at `.agents/rules/<name>.md` whose frontmatter includes `trigger: glob` and corresponding `globs`

### Requirement: Skills materialize under .agents/skills

Skill primitives MUST materialize to `.agents/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory (dereferenced, contained under plugin root) into that destination. Skill materialize MUST NOT write MCP config as a side effect.

#### Scenario: Skill appears under cross-tool skills root

- **WHEN** Antigravity materialize runs with a skill primitive
- **THEN** the skill MUST appear at `.agents/skills/<name>/SKILL.md`

### Requirement: Hooks merge into .agents/hooks.json with agy schema and ownership sidecar

Hook primitives MUST merge into a single project file `.agents/hooks.json` using Antigravity’s native event-dependent schema (nested matcher/`hooks[]` for events such as PreToolUse/PostToolUse/PreInvocation/PostInvocation; flat handler lists for events such as Stop). Timeouts MUST remain in seconds (not millisecond conversion). Referenced scripts MUST deploy under a documented `.agents/hooks/` scripts subtree. The package MUST maintain a project sidecar at `.agents/bapm-hooks.json` listing bapm-owned hook/script paths so reinstall can remove previously owned artifacts before rewrite. Ownership metadata MUST NOT be embedded as private keys inside user-facing hook handler objects that Antigravity loads as configuration (sidecar is the ownership source of truth). Unrelated top-level hook-name containers in `.agents/hooks.json` MUST be preserved. Reinstall MUST be idempotent for owned hooks.

#### Scenario: Hook merges into native hooks.json

- **WHEN** Antigravity materialize runs with a valid hook primitive
- **THEN** `.agents/hooks.json` MUST exist with the owned event entries in agy schema and scripts under `.agents/hooks/`

#### Scenario: Reinstall replaces owned hooks only

- **WHEN** Antigravity materialize runs again after a prior owned hooks deploy
- **THEN** previously bapm-owned hook entries/scripts listed in the sidecar MUST be replaceable/removable and unrelated user hook-name containers MUST remain

### Requirement: Agents and commands are skipped

When the conflict-resolved primitive set contains `agent` or `command` primitives, Antigravity materialize MUST skip native file writes for those kinds and MUST emit non-fatal diagnostics. Materialize MUST NOT invent agents/commands directories under `.agents/` for those kinds.

#### Scenario: Agent primitive is skipped

- **WHEN** Antigravity materialize runs with an agent primitive
- **THEN** no Antigravity-native agent file MUST be written and a skip diagnostic MUST be reported

#### Scenario: Command primitive is skipped

- **WHEN** Antigravity materialize runs with a command primitive
- **THEN** no Antigravity-native command/workflow file MUST be written and a skip diagnostic MUST be reported

### Requirement: Active Antigravity invocation may create .agents for materialize but MCP stays opt-in

When Antigravity materialize is actively invoked for the Antigravity target (including forced `--target antigravity`), writers MUST be allowed to create `.agents/` directories as needed for rules/skills/hooks. Auto-detect MUST still return false. Project MCP configure MUST remain opt-in on an existing `.agents/` directory (see MCP requirement) and MUST NOT invent `.agents/` solely to write MCP.

#### Scenario: Forced antigravity creates roots for materialize

- **WHEN** install runs with forced target `antigravity` registered and no `.agents/` present
- **THEN** materialize MAY create registered `.agents/` deploy roots and write rules/skills/hooks under them

### Requirement: Project MCP configure is opt-in under .agents/mcp_config.json

When install invokes Antigravity `configureMcp` with an eligible server set, `@bapm/integration-antigravity` MUST create or update project `.agents/mcp_config.json` under the top-level `mcpServers` object keyed by server name **only when** project `.agents/` already exists as a directory. When `.agents/` is absent, configure MUST skip writing with a diagnostic and MUST NOT create `.agents/` solely for MCP. Remote/HTTP server URL fields MUST be written using `serverUrl` (not bare `url` / `httpUrl` alone) when a remote endpoint is configured. Writes MUST preserve unrelated `mcpServers` names and unrelated top-level keys, MUST be idempotent overwrites of owned server keys, and MUST report a non-empty configuration path for lock inventory. This capability MUST NOT write user-scope `~/.gemini/config/mcp_config.json`.

#### Scenario: Configure writes mcpServers when .agents exists

- **WHEN** project `.agents/` exists and Antigravity configureMcp is invoked with a stdio server definition
- **THEN** `.agents/mcp_config.json` MUST contain that server under `mcpServers`

#### Scenario: Configure skips when .agents absent

- **WHEN** project `.agents/` is absent and configureMcp runs for Antigravity
- **THEN** configure MUST NOT create `.agents/mcp_config.json` and MUST report a skip diagnostic

#### Scenario: Remote servers use serverUrl

- **WHEN** configureMcp receives a remote server with a URL endpoint
- **THEN** the written entry MUST include `serverUrl` for that endpoint

#### Scenario: Existing unrelated servers are preserved

- **WHEN** `.agents/mcp_config.json` already contains other `mcpServers` entries and configureMcp writes a new owned server
- **THEN** unrelated server names MUST remain intact

### Requirement: Thin compile emits AGENTS.md and omits deployed rules

When Antigravity exposes `compile` and compile is invoked for that target, the emitter MUST produce project-root `AGENTS.md` (or the compile output path supplied for that target), honor write vs validate/preview intent, and order primitives deterministically. Instruction primitives that materialize already deploys under `.agents/rules/` for the same install/compile set MUST be omitted from the thin compile body to avoid duplicate Antigravity context. Compile MUST NOT implement rich APM managed sections or user-scope `~/.gemini/**` outputs.

#### Scenario: Compile writes AGENTS.md

- **WHEN** compile runs with Antigravity active and write intent true
- **THEN** `AGENTS.md` MUST be written (or the supplied output path) and the report MUST reflect wrote=true

#### Scenario: Deployed rules are omitted from compile body

- **WHEN** compile receives instruction primitives that materialize already deploys under `.agents/rules/`
- **THEN** the compile body MUST NOT duplicate those instruction contents as compile sections

### Requirement: Unsupported surfaces stay out of this runtime

Antigravity runtime in this capability MUST NOT write user-scope paths under `~/.gemini/`, MUST NOT auto-detect from shared `.agents/`, and MUST NOT claim unrelated `.agents/` subtrees beyond rules, skills, hooks, and `mcp_config.json` (for example marketplace plugin trees).

#### Scenario: User gemini home is not written

- **WHEN** Antigravity materialize or configureMcp runs for supported project-scope operations
- **THEN** paths under `~/.gemini/` MUST NOT be created as a side effect of this runtime

### Requirement: Not imported by core

`@bapm/core` MUST NOT hard-depend on or statically import `@bapm/integration-antigravity`. Registration for CLI or e2e MUST occur through the integration API registry after object-map load (or an equivalent test harness registration).

#### Scenario: Core package graph excludes antigravity

- **WHEN** inspecting `@bapm/core` dependencies
- **THEN** `@bapm/integration-antigravity` MUST NOT appear as a dependency
