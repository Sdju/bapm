## ADDED Requirements

### Requirement: Shared trust classification for audit twin
Audit (or an equivalent trust classifier invoked by audit Mode B / CI paths) MUST classify MCP executable trust using the same layered deny-wins resolver as the install MCP gate. For identical org, project, user, package, and MCP-type inputs, the classification outcome MUST match install.

#### Scenario: Twin outcome on shared fixtures
- **WHEN** the same layered inputs are evaluated by install gate and by the audit/trust classifier
- **THEN** both MUST report the same allow, deny, or withhold outcome for that package's MCP

### Requirement: Required package presence from lockfile
When evaluating governance `dependencies.require` for audit/presence fidelity (sc-012), package presence MUST be satisfied from **resolved lockfile** membership. Presence MUST NOT fail solely because MCP (or other executables) for that package were withheld from deploy.

#### Scenario: Present in lock satisfies require despite withheld MCP
- **WHEN** policy requires package `org/base`, the lockfile lists `org/base`, and MCP for `org/base` is withheld by the trust resolver
- **THEN** require presence MUST be satisfied and MUST NOT emit a missing-package / `POLICY_REQUIRE` failure for that package solely due to withhold

#### Scenario: Missing from lock fails require presence
- **WHEN** policy requires package `org/base` and the lockfile does not list `org/base`
- **THEN** presence evaluation MUST report a missing/required-package failure distinct from an executable-withheld diagnostic

### Requirement: Distinct withheld diagnostic for present required package
When a required package is present in the lockfile and MCP for that package is withheld, the system MUST emit a diagnostic with a stable code/name that is **distinct** from `POLICY_REQUIRE` and from missing-package failures.

#### Scenario: Withheld code differs from POLICY_REQUIRE
- **WHEN** a required package is lock-present and MCP is withheld
- **THEN** diagnostics MUST include a withheld/trust code that is not `POLICY_REQUIRE` and MUST NOT classify the package as missing
