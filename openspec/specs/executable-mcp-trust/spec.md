# executable-mcp-trust Specification

## Purpose

Defines OpenAPM sc-009 executable trust for MCP: when the consuming project declares an allowExecutables / executables.allow grant set, unapproved dependency MCP MUST NOT deploy—fail closed—while non-executable primitives may still materialize.

## Requirements

### Requirement: Documented grant vocabulary aliases
The system MUST accept a documented alias set for executable approval grants matching APM/OpenAPM vocabulary. Preferred wire forms MUST include project-level `executables.allow` (and deny when present) and MUST document `allowExecutables` as an accepted alias when dual-read drop-in requires it. One primary form SHOULD be preferred in emitted/docs examples.

#### Scenario: Allow list recognized under primary form
- **WHEN** the consuming manifest declares `executables.allow` listing a package for MCP/executable type
- **THEN** the trust gate MUST treat that package as approved for MCP deploy of that type

#### Scenario: allowExecutables alias accepted
- **WHEN** the consuming manifest uses the documented `allowExecutables` alias instead of `executables.allow`
- **THEN** the trust gate MUST apply the same approval semantics

### Requirement: Fail closed when grants present and package unapproved
When the consuming project has an `allowExecutables` / `executables.allow` block (non-absent grant surface), MCP configuration from a dependency MUST NOT be written to `.cursor/mcp.json` unless that package is approved for the executable/MCP type. The gate MUST fail closed: either non-zero exit or a clear withhold diagnostic that prevents silent deploy of the MCP entry.

#### Scenario: sc-009 withhold unapproved MCP
- **WHEN** `allowExecutables` / `executables.allow` is present, a dependency provides MCP, and the package is not listed in the approval set
- **THEN** that MCP entry MUST NOT be written to `.cursor/mcp.json` and the run MUST surface a non-zero outcome or explicit withhold diagnostic

#### Scenario: Approved package MCP writes
- **WHEN** the same grant surface lists the package as approved for MCP/executable type
- **THEN** eligible MCP for that package MUST be allowed to write under cursor MCP deploy rules

### Requirement: Non-executable primitives still materialize when MCP withheld
When MCP is withheld by the executable trust gate, install MUST still be allowed to materialize non-executable primitives (skills, instructions, agents) for otherwise installable dependencies, unless a separate policy/install failure applies.

#### Scenario: Skills deploy while MCP withheld
- **WHEN** MCP from a dependency is withheld under sc-009 and the dependency also provides a skill
- **THEN** the skill MAY/MUST still materialize per existing cursor rules and MCP MUST remain undeployed

### Requirement: Full approve deny CLI not required for grants
Authoring grants in project manifest YAML MUST be sufficient to pass the M9 trust bar. Interactive `bapm approve` / `bapm deny` CLI is OPTIONAL (SHOULD). If an interactive approval path ships, interactive decisions MUST land user-local only and MUST NOT be auto-written into `apm.yml`/`bapm.yml` (sc-010).

#### Scenario: Manifest grants without approve CLI
- **WHEN** grants exist only in project manifest YAML and no approve CLI is invoked
- **THEN** the sc-009 gate MUST still enforce approve/withhold using those grants

### Requirement: Deny-wins with org policy is SHOULD
When org/project policy executables deny is modeled (M8 policy `executables` / related), a shared deny-wins resolver (sc-011) SHOULD treat org deny above project/user grant such that install gate outcome matches audit. This is not required to claim M9 MUST pass if only project-manifest sc-009 is implemented.

#### Scenario: Org deny beats project grant when wired
- **WHEN** sc-011 wiring is present, org policy denies an executable package, and project grants allow it
- **THEN** MCP deploy for that package MUST be denied at install
