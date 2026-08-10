# integration-copilot-runtime Specification

## Purpose

Defines the greenfield `@b-apm/integration-copilot` package: GitHub Copilot project-scope detect, materialize under `.github/` and `.agents/`, home-scoped MCP translate configure for Copilot CLI, and thin compile to `.github/copilot-instructions.md`, depending only on `@b-apm/integration-api`.

## Requirements

### Requirement: Package @b-apm/integration-copilot exists and depends only on integration API

The monorepo MUST include package directory `packages/integration-copilot` with package name `@b-apm/integration-copilot`. The package MUST be TypeScript ESM with vite-plus tooling consistent with other `@b-apm/integration-*` packages. Among bapm packages it MUST depend on `@b-apm/integration-api` for types and contracts and MUST NOT require `@b-apm/core` as a hard dependency for host capability implementation. The package MUST export a runtime factory usable as `createIntegration` and MAY export `createCopilotIntegration` as an alias. Runtime integration `id` MUST be `copilot`. The package MUST NOT expose a marketplace-output mapper in this capability.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the Copilot package dependencies
- **THEN** `@b-apm/integration-copilot` depends on `@b-apm/integration-api` and does not reverse-depend on `@b-apm/core` for its host behavior

#### Scenario: Runtime factory registers as copilot

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `copilot` and MUST expose `detect` and `materialize`

### Requirement: Detect uses APM Copilot signal whitelist

The Copilot integration MUST return true from `detect` when any one of these project-root signals exists: file `.github/copilot-instructions.md`; directory `.github/instructions/`; directory `.github/agents/`; directory `.github/prompts/`; directory `.github/hooks/`. Detection MUST return false for an empty project with none of those signals. Detection MUST NOT create those paths solely to opt into auto-detect.

#### Scenario: Each whitelist signal alone activates detect

- **WHEN** the project has exactly one whitelist signal present and Copilot is registered
- **THEN** copilot `detect` MUST return true

#### Scenario: Empty project is not Copilot

- **WHEN** none of the whitelist signals exist under the project
- **THEN** copilot `detect` MUST return false and MUST NOT create `.github/` or `.agents/` solely for detection

### Requirement: Deploy roots cover .github and .agents

Registered default deploy roots for Copilot MUST include `.github` and `.agents`. Materialize writes for instructions, prompts, agents, and hooks MUST stay under `.github/`. Materialize writes for skills MUST stay under `.agents/`. Writes MUST NEVER escape registered deploy roots for project-scope materialize. Home-scoped MCP configure is exempt from project deploy-root assertion (documented separately).

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a project path outside registered deploy roots
- **THEN** the write MUST fail closed and MUST NOT create the escaped path

### Requirement: Instructions materialize under .github/instructions

Instruction primitives MUST materialize to `.github/instructions/<name>.instructions.md` under registered deploy roots. Copilot-relevant frontmatter such as `applyTo` MUST be preserved when present in the source. Instruction materialize MUST NOT write MCP config as a side effect.

#### Scenario: Instruction becomes github instructions file

- **WHEN** Copilot materialize runs with an instruction primitive
- **THEN** a file MUST exist at `.github/instructions/<name>.instructions.md`

### Requirement: Commands materialize as Copilot prompts not commands

When the conflict-resolved primitive set contains `command` primitives (including sources discovered as `*.prompt.md`), Copilot materialize MUST write `.github/prompts/<name>.prompt.md` and MUST NOT write under `.github/commands/` or Cursor-style commands paths. Prompt body and Copilot-compatible frontmatter MUST be preserved as feasible.

#### Scenario: Prompt-like command lands under prompts

- **WHEN** Copilot materialize runs with a `command` primitive sourced from a `*.prompt.md` file
- **THEN** the file MUST appear at `.github/prompts/<name>.prompt.md` and MUST NOT appear under `.github/commands/`

### Requirement: Agents materialize under .github/agents

Agent primitives MUST materialize to `.github/agents/<name>.agent.md` under registered deploy roots. Agent materialize MUST NOT write MCP config as a side effect.

#### Scenario: Agent becomes Copilot agent markdown

- **WHEN** Copilot materialize runs with an agent primitive
- **THEN** a file MUST exist at `.github/agents/<name>.agent.md`

### Requirement: Skills materialize under .agents/skills

Skill primitives MUST materialize to `.agents/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory (dereferenced, contained under plugin root) into that destination. Skill materialize MUST NOT write `.github/skills/` and MUST NOT write MCP config as a side effect.

#### Scenario: Skill appears under cross-tool skills root

- **WHEN** install runs with Copilot registered and a dependency provides a skill
- **THEN** the skill MUST appear at `.agents/skills/<name>/SKILL.md` and MUST NOT be written under `.github/skills/`

#### Scenario: Portable skill directory is fully copied

- **WHEN** install runs with Copilot active and a portable Agent Plugins skill with auxiliary files under `skillDirectory`
- **THEN** those auxiliary files MUST be present under `.agents/skills/<name>/` after materialize

### Requirement: Hooks deploy as per-file JSON with camelCase events and ownership

Hook primitives MUST materialize as per-file JSON at `.github/hooks/<pkg>-<stem>.json` (sanitized package and stem names) with referenced scripts under `.github/hooks/scripts/<pkg>/` (or an equivalent documented scripts subtree under `.github/hooks/`). Event names written for Copilot MUST be normalized to camelCase. The package MUST maintain a project sidecar at `.github/bapm-hooks.json` listing bapm-owned hook file and script paths so reinstall can remove previously owned artifacts before rewrite. Ownership metadata MUST NOT be embedded as Copilot-private keys inside the per-file hook JSON payloads. Reinstall MUST be idempotent for owned hooks.

#### Scenario: Hook becomes per-file JSON with camelCase event

- **WHEN** Copilot materialize runs with a valid hook primitive whose source uses a non-camelCase event name
- **THEN** `.github/hooks/<pkg>-<stem>.json` MUST exist and the written event key MUST be camelCase

#### Scenario: Reinstall replaces owned hooks only

- **WHEN** Copilot materialize runs again after a prior owned hooks deploy
- **THEN** previously bapm-owned hook files/scripts listed in the sidecar MUST be replaceable/removable and unrelated user hook files under `.github/hooks/` MUST remain

### Requirement: Active Copilot invocation may create project deploy roots

When Copilot materialize is actively invoked for the Copilot target (including forced `--target copilot`), writers MUST be allowed to create `.github/` and `.agents/` directories as needed. Auto-detect without a whitelist signal MUST still return false and MUST NOT mkdir solely to opt into detect.

#### Scenario: Forced copilot creates roots

- **WHEN** install runs with forced target `copilot` registered and no whitelist signals present
- **THEN** materialize MAY create registered deploy roots and write primitives under them

### Requirement: Home MCP configure with translate placeholders

When install invokes Copilot `configureMcp` with an eligible server set, `@b-apm/integration-copilot` MUST create or update the user-home file `~/.copilot/mcp-config.json` (resolved via `COPILOT_HOME` when documented, otherwise the default home `.copilot` directory) under the top-level `mcpServers` object keyed by server name. Env (and headers when present) placeholder values MUST be written in host translate form `${VAR}` without baking secrets from `process.env` into the file for APM-style `${VAR}` / `${env:VAR}` / `<VAR>` tokens. Writes MUST preserve unrelated `mcpServers` names and unrelated top-level keys, MUST be idempotent overwrites of owned server keys, and MUST report a non-empty configuration path for lock inventory (absolute or `~/.copilot/mcp-config.json` form is acceptable for this home-scoped host). This capability MUST NOT write project `.vscode/mcp.json`.

#### Scenario: Configure writes mcpServers in home mcp-config.json

- **WHEN** Copilot configureMcp is invoked with a stdio server definition
- **THEN** `~/.copilot/mcp-config.json` MUST contain that server under `mcpServers`

#### Scenario: Env placeholders are translated not baked

- **WHEN** a server env value is `${API_TOKEN}` or equivalent APM placeholder form and configureMcp runs for Copilot
- **THEN** the written env value MUST remain a `${VAR}`-style runtime placeholder and MUST NOT be replaced with the process environment secret literal

#### Scenario: Existing unrelated servers are preserved

- **WHEN** `~/.copilot/mcp-config.json` already contains other `mcpServers` entries and configureMcp writes a new owned server
- **THEN** unrelated server names MUST remain intact

### Requirement: Thin compile emits copilot-instructions.md and omits deployed instructions

When Copilot exposes `compile` and compile is invoked for that target, the emitter MUST produce `.github/copilot-instructions.md` (or the compile output path supplied for that target), honor write vs validate/preview intent, and order primitives deterministically. Instruction primitives that were materialized under `.github/instructions/` for the same install/compile set MUST be omitted from the thin compile body to avoid duplicate Copilot context. Compile MUST NOT implement canvas, rich APM managed sections, or user-scope `~/.copilot/AGENTS.md`.

#### Scenario: Compile writes copilot-instructions.md

- **WHEN** compile runs with Copilot active and write intent true
- **THEN** `.github/copilot-instructions.md` MUST be written (or the supplied output path) and the report MUST reflect wrote=true

#### Scenario: Deployed instructions are omitted from compile body

- **WHEN** compile receives instruction primitives that materialize already deploys under `.github/instructions/`
- **THEN** the compile body MUST NOT duplicate those instruction contents as compile sections

### Requirement: Unsupported surfaces stay out of this runtime

Copilot runtime in this capability MUST NOT write canvas/extension trees under `.github/extensions/`, MUST NOT deploy user-scope file primitives under `~/.copilot/prompts` (or concat user instructions), and MUST NOT write project `.vscode/mcp.json`.

#### Scenario: Canvas paths are not created by materialize

- **WHEN** Copilot materialize runs for supported primitive kinds
- **THEN** `.github/extensions/` MUST NOT be created as a canvas deploy side effect

### Requirement: Not imported by core

`@b-apm/core` MUST NOT hard-depend on or statically import `@b-apm/integration-copilot`. Registration for CLI or e2e MUST occur through the integration API registry after object-map load (or an equivalent test harness registration).

#### Scenario: Core package graph excludes copilot

- **WHEN** inspecting `@b-apm/core` dependencies
- **THEN** `@b-apm/integration-copilot` MUST NOT appear as a dependency
