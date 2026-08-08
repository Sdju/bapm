## ADDED Requirements

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

## MODIFIED Requirements

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
