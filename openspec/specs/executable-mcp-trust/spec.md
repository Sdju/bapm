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

### Requirement: Layered deny-wins resolveExecutableTrust

The system MUST provide a single pure trust resolver that combines org policy executable denials, project manifest grants, and user-local grants for a package and executable type (MCP for this claim). Precedence MUST be deny-wins: org `deny_all` or org deny match overrides any project or user allow; then project/user deny; then project allow; then user allow; when a grant surface is present and no allow matches, the outcome MUST be withhold (fail-closed). Org deny MUST NOT be re-enabled by project or user grant.

#### Scenario: Org deny shadows project allow

- **WHEN** org policy denies package `mcp-dep` for MCP and the project manifest allows that package for MCP
- **THEN** the resolver MUST return deny (not allow) for that package and MCP type

#### Scenario: Org deny_all shadows user allow

- **WHEN** org policy sets `executables.deny_all: true` and the user store allows package `mcp-dep` for MCP
- **THEN** the resolver MUST return deny for that package and MCP type

#### Scenario: User allow applies when not org-denied

- **WHEN** no org deny applies, the project grant surface is present without an allow for `mcp-dep`, and the user store allows `mcp-dep` for MCP
- **THEN** the resolver MUST return allow for that package and MCP type

#### Scenario: Unapproved withholds when surface present

- **WHEN** a grant surface is present (project and/or user), org does not deny, and neither project nor user allows the package for MCP
- **THEN** the resolver MUST return withhold (fail-closed) for MCP

### Requirement: Install MCP gate uses shared resolver

The install MCP deploy gate MUST call the same layered resolver used for audit/trust classification. For identical inputs (org + project + user + package + MCP type), install withhold/deny/allow MUST match the classifier outcome.

#### Scenario: Install matches classifier on org deny

- **WHEN** identical layered inputs yield deny from the shared resolver
- **THEN** install MUST withhold MCP deploy for that package and the audit/trust classifier MUST report the same deny outcome

### Requirement: Soft surface for non-MCP executables

Hooks, bin, and canvas executable primitives MUST remain ungated by this change's trust ladder. Documentation and Limitations MUST state honestly that gate+audit twin coverage is MCP-only (matching the already-claimed sc-009 thin surface).

#### Scenario: Soft honesty documented

- **WHEN** a reader reviews Limitations or trust docs after this change
- **THEN** the text MUST state that hooks/bin/canvas are not gated like MCP under the claimed executable governance surface

### Requirement: Full approve deny CLI not required for grants

Authoring grants in project manifest YAML MUST remain sufficient for the sc-009 project grant surface. When interactive `bapm approve` / `bapm deny` ships, interactive decisions MUST land user-local only and MUST NOT be auto-written into `apm.yml`/`bapm.yml` (sc-010). Project YAML grants remain a valid non-interactive admin path.

#### Scenario: Manifest grants without approve CLI

- **WHEN** grants exist only in project manifest YAML and no approve CLI is invoked
- **THEN** the sc-009 gate MUST still enforce approve/withhold using those grants

#### Scenario: Interactive path does not rewrite project yml

- **WHEN** interactive approve or deny is used
- **THEN** the project manifest MUST NOT receive that interactive decision as a write

### Requirement: Deny-wins with org policy is SHOULD

When org policy `executables.deny` / `deny_all` is modeled, a shared deny-wins resolver (sc-011) MUST treat org deny above project/user grant such that install gate outcome matches audit classification for identical inputs. Project/user grants MUST NOT re-enable an org-denied MCP primitive.

#### Scenario: Org deny beats project grant when wired

- **WHEN** org policy denies an executable package and project grants allow it
- **THEN** MCP deploy for that package MUST be denied at install and the shared classifier MUST agree
