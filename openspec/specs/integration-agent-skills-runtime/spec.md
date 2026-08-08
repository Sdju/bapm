# integration-agent-skills-runtime Specification

## Purpose
Defines the explicit-only `agent-skills` cross-client skills host on `@bapm/integration-agent-skills`: never auto-detect, skills-only materialize to `.agents/skills/<name>/SKILL.md`, and no MCP/hooks/compile surface.
## Requirements
### Requirement: Package exposes thin runtime factory

`@bapm/integration-agent-skills` MUST export a runtime integration factory usable as `createIntegration` (and MAY export an `createAgentSkillsIntegration` alias). The runtime integration MUST implement `BapmIntegration` with at least `id`, `deployRoots`, `detect`, and `materialize`. Package id for the runtime target MUST be `agent-skills`. The package MUST depend on `@bapm/integration-api` without requiring `@bapm/core` as a hard dependency for host behavior. The integration MUST NOT expose `configureMcp` or `compile`.

#### Scenario: Runtime factory registers as agent-skills

- **WHEN** a consumer calls the package runtime factory and registers the result
- **THEN** the integration `id` MUST be `agent-skills` and MUST expose `detect` and `materialize`

#### Scenario: No MCP or compile capability

- **WHEN** inspecting the created integration object
- **THEN** `configureMcp` and `compile` MUST be absent (undefined / not provided)

### Requirement: Detect never auto-activates

The agent-skills integration MUST always return false from `detect`, regardless of whether `.agents/`, `.agents/skills/`, or other shared harness directories exist. Detection MUST NOT create `.agents/` solely to opt into auto-detect.

#### Scenario: Existing .agents does not detect

- **WHEN** the project has `.agents/skills/` (or `.agents/`) on disk and agent-skills is registered
- **THEN** agent-skills `detect` MUST return false

#### Scenario: Empty project does not detect

- **WHEN** neither `.agents/` nor other signals exist
- **THEN** agent-skills `detect` MUST return false and MUST NOT create `.agents/`

### Requirement: Activation is explicit only

agent-skills MUST activate only when the composition root / install selects it via forced `--target agent-skills`, or via manifest `active` listing `agent-skills` after object-map registration of `@bapm/integration-agent-skills`. Presence of `.agents/` alone MUST NOT activate the host.

#### Scenario: Forced target activates without detect

- **WHEN** agent-skills is registered and install runs with forced target `agent-skills`
- **THEN** install MUST invoke agent-skills materialize even though `detect` is false

#### Scenario: Manifest active activates without detect

- **WHEN** the manifest declares object-map `targets.agent-skills` to this package and `active: [agent-skills]`, and install runs without `--target`
- **THEN** install MUST activate `agent-skills` and MUST invoke its materialize

### Requirement: Deploy roots cover .agents only

Registered default deploy roots for agent-skills MUST be `.agents` (or an equivalent list whose only root is `.agents`). Materialize writes MUST stay under `.agents/`. Writers MUST fail closed if a path would escape registered deploy roots.

#### Scenario: Materialize refuses escapes outside deploy roots

- **WHEN** materialize would write a path outside registered deploy roots
- **THEN** the write MUST fail closed (throw or equivalent hard failure) and MUST NOT create the escaped path

### Requirement: Skills materialize under .agents/skills

When agent-skills is active, skill primitives MUST materialize to `.agents/skills/<name>/SKILL.md` under registered deploy roots. Portable Agent Plugins skills (`format: "agent-plugin"` with `skillDirectory`) MUST copy the complete skill directory (dereferenced, contained under plugin root) into that destination. Skill materialize MUST NOT write MCP config, hooks, or compile outputs as a side effect.

#### Scenario: Skill appears under cross-tool skills root

- **WHEN** install runs with agent-skills registered/active and a dependency provides a skill
- **THEN** the skill MUST appear at `.agents/skills/<name>/SKILL.md`

#### Scenario: Portable skill directory is fully copied

- **WHEN** install runs with agent-skills active and a portable Agent Plugins skill with auxiliary files under `skillDirectory`
- **THEN** those auxiliary files MUST be present under `.agents/skills/<name>/` after materialize

### Requirement: Non-skill primitives skip native files

Instruction, agent, command, prompt, hook, and other non-skill primitives MUST NOT write agent-skills host files during materialize. The integration MUST keep install non-fatal for those kinds and MUST emit non-fatal diagnostics identifying the skipped kind.

#### Scenario: Instruction does not write a host file

- **WHEN** agent-skills materialize runs with an instruction primitive
- **THEN** no host file MUST be created for that primitive under `.agents/`

#### Scenario: Hook does not write hooks config

- **WHEN** agent-skills materialize runs with a hook primitive
- **THEN** no hooks JSON or scripts MUST be written under `.agents/`

#### Scenario: Diagnostic names skipped kind

- **WHEN** a non-skill primitive is skipped
- **THEN** materialize MUST report a diagnostic that identifies the primitive and that agent-skills supports skills only

### Requirement: Shared skills path overlap is allowed

Writing skills to `.agents/skills/` MUST be treated as intentional overlap with other hosts that use the same path (Cursor, Codex, Copilot, antigravity). The agent-skills package MUST NOT attempt exclusive ownership of `.agents/skills/` or refuse materialize solely because another host also targets that directory.

#### Scenario: Overlap with another .agents skills host is non-blocking

- **WHEN** agent-skills materialize writes a skill that another registered host would also place under `.agents/skills/<name>/`
- **THEN** agent-skills materialize MUST still succeed for that skill path (last-writer / shared-path semantics left to install orchestration)

### Requirement: Docs document object-map load

User-facing docs MUST document that `agent-skills` is an explicit-only target loaded via object-map, for example `targets.agent-skills: "@bapm/integration-agent-skills"`, and that it never auto-detects from `.agents/`.

#### Scenario: Supported hosts lists agent-skills

- **WHEN** a reader opens supported-hosts documentation after this change
- **THEN** agent-skills MUST appear with explicit-only activation and skills-only layout guidance

