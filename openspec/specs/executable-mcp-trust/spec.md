# executable-mcp-trust Specification

## Purpose

Defines OpenAPM sc-009 executable trust for MCP: when the consuming project declares an allowExecutables / executables.allow grant set, unapproved dependency MCP MUST NOT deploy. Explicit deny (project, user, or org), plus a package mentioned in the grant surface without an MCP approval, MUST fail install; a package never mentioned in any allow/deny map is skipped with a non-fatal `MCP_NOT_APPROVED` warning while non-executable primitives may still materialize. One grant MUST NOT make every unrelated dependency MCP package fatal.

## Requirements

### Requirement: Documented grant vocabulary aliases

The system MUST accept a documented alias set for executable approval grants matching APM/OpenAPM vocabulary. Preferred wire forms MUST include project-level `executables.allow` (and deny when present) and MUST document `allowExecutables` as an accepted alias when dual-read drop-in requires it. One primary form SHOULD be preferred in emitted/docs examples.

#### Scenario: Allow list recognized under primary form

- **WHEN** the consuming manifest declares `executables.allow` listing a package for MCP/executable type
- **THEN** the trust gate MUST treat that package as approved for MCP deploy of that type

#### Scenario: allowExecutables alias accepted

- **WHEN** the consuming manifest uses the documented `allowExecutables` alias instead of `executables.allow`
- **THEN** the trust gate MUST apply the same approval semantics

### Requirement: Unapproved dependency MCP never deploys; explicit decisions fail install

When dependency MCP is in scope (a project/user grant surface is present or `--trust-transitive-mcp` is passed), MCP configuration from a dependency MUST NOT be written to `.cursor/mcp.json` unless that package is approved for the executable/MCP type. Install MUST distinguish three outcomes:

- **fatal** – explicit deny from org policy (`executables.deny` / `deny_all`), project `executables.deny`, or user deny; install MUST fail with a withhold message naming the package;
- **fatal** – the package IS mentioned in a project/user allow or deny map but is not approved for MCP (for example `mcp: false`, or an entry for another executable type only); install MUST fail with a withhold message naming the package;
- **non-fatal skip** – the package has no entry at all in project/user allow/deny and is not org-denied; its MCP MUST NOT deploy, install MUST continue, and a `warn: true` `MCP_NOT_APPROVED` diagnostic MUST name the package and suggest `bapm approve <pkg>` or `executables.allow.<pkg>.mcp: true`.

With `--trust-transitive-mcp` and no grant surface, dependency MCP MUST deploy as before (resolver outcome `skip`).

#### Scenario: Unmentioned unapproved MCP is skipped with a warning

- **WHEN** `allowExecutables` / `executables.allow` is present (including an entry for an unrelated package), a dependency provides MCP, and the package is not mentioned in any allow/deny map
- **THEN** that MCP entry MUST NOT be written to `.cursor/mcp.json`, install MUST succeed, and the run MUST emit a non-fatal `MCP_NOT_APPROVED` warning naming the package

#### Scenario: Unrelated grant does not break a second dependency

- **WHEN** one dependency package is approved and another dependency package with MCP is unmentioned
- **THEN** the approved MCP MAY deploy, the second MCP MUST NOT deploy, and install MUST NOT fail solely because the second package is undecided

#### Scenario: Explicit project or user deny is fatal

- **WHEN** the package is denied by project `executables.deny`, user deny, or org policy
- **THEN** install MUST fail with a withhold message naming the package and MUST NOT deploy its MCP

#### Scenario: Mentioned-but-unapproved package is fatal

- **WHEN** the package appears in an allow/deny map with `mcp: false` or with another executable type only
- **THEN** install MUST fail with a withhold message naming the package and MUST NOT deploy its MCP

#### Scenario: Org deny_all remains fatal

- **WHEN** org policy sets `executables.deny_all: true`
- **THEN** install MUST fail for dependency MCP even when no project/user grant surface exists and the package is otherwise unmentioned

#### Scenario: Approved package MCP writes

- **WHEN** the same grant surface lists the package as approved for MCP/executable type
- **THEN** eligible MCP for that package MUST be allowed to write under cursor MCP deploy rules

#### Scenario: Trust-transitive without surface still deploys

- **WHEN** `--trust-transitive-mcp` is passed and no project/user grant surface and no org deny are present
- **THEN** dependency MCP MUST deploy as before

### Requirement: Non-executable primitives still materialize when MCP is withheld or skipped

When MCP is withheld or skipped by the executable trust gate, install MUST still be allowed to materialize non-executable primitives (skills, instructions, agents) for otherwise installable dependencies, unless a separate policy/install failure applies.

#### Scenario: Skills deploy while MCP is withheld or skipped

- **WHEN** MCP from a dependency is withheld or skipped under sc-009 and the dependency also provides a skill
- **THEN** the skill MAY/MUST still materialize per existing cursor rules and MCP MUST remain undeployed

### Requirement: Layered deny-wins resolveExecutableTrust

The system MUST provide a single pure trust resolver that combines org policy executable denials, project manifest grants, and user-local grants for a package and executable type (MCP for this claim). Precedence MUST be deny-wins: org `deny_all` or org deny match overrides any project or user allow; then project/user deny; then project allow; then user allow; when a grant surface is present and no allow matches, the outcome MUST be withhold. The resolver reports `withhold` but MUST NOT itself decide install fatality: install treats `deny` and a withhold for a mentioned package as fatal, and a withhold for an unmentioned package as a warning skip. Org deny MUST NOT be re-enabled by project or user grant.

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
- **THEN** the resolver MUST return withhold for MCP (install decides fatal vs warning skip from whether the package is mentioned or explicitly denied)

### Requirement: Install MCP gate uses shared resolver

The install MCP deploy gate MUST call the same layered resolver used for audit/trust classification. For identical inputs (org + project + user + package + MCP type), install withhold/deny/allow MUST match the classifier outcome.

#### Scenario: Install matches classifier on org deny

- **WHEN** identical layered inputs yield deny from the shared resolver
- **THEN** install MUST withhold MCP deploy for that package and the audit/trust classifier MUST report the same deny outcome

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

### Requirement: Dependency hooks are gated with a trust surface while canvas stays unimplemented

Dependency hook primitives MUST pass through the shared executable trust resolver (type `hook`) before materialize when the consuming project or user store presents a grant surface, or when org policy `executables.deny` / `deny_all` is active. A withheld hook MUST be dropped and reported with a warning diagnostic naming the package and reason. With no grant surface and no org deny, dependency hooks MAY keep the legacy soft default and deploy. Root/local hooks MUST NOT be gated. Canvas has no primitive/materialize path and MUST remain listed as unimplemented/soft. Dependency `bin/` MUST be gated via the shared executable trust resolver (type `bin`) plus install `--trust-bin` / `--no-trust-bin` consent. The conformance statement MUST list the hook gating boundary and canvas non-implementation in its limitations and MUST NOT list `bin` as ungated.

#### Scenario: Unapproved dependency hook is withheld under a grant surface

- **WHEN** a dependency ships a hook and the consuming project has an `executables.allow` surface that does not mention that dependency's `hook`
- **THEN** install MUST withhold the hook, MUST report `HOOK_TRUST_WITHHELD` as a warning, and MUST continue installing other primitives

#### Scenario: Hook grant deploys

- **WHEN** the project or user store allows the dependency with `hook: true`
- **THEN** install MUST deploy the hook for hosts that support hooks

#### Scenario: Org deny withholds hooks without a project surface

- **WHEN** org policy `executables.deny` lists the dependency (or `deny_all: true`)
- **THEN** install MUST withhold its hooks even when no project grant surface exists

#### Scenario: Legacy no-surface hook deploy

- **WHEN** a dependency ships a hook and neither project/user grant surface nor org deny is present
- **THEN** install MUST still deploy the hook for hosts that support hooks

#### Scenario: Bin is gated by the shared resolver

- **WHEN** a dependency ships `bin/` and non-interactive install runs without `--trust-bin` and without a `bin` grant
- **THEN** install MUST NOT deploy that `bin/`
