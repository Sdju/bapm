## MODIFIED Requirements

### Requirement: Shared ExecutableTrust ladder for bin type

Bin consent MUST evaluate package approval through the same layered deny-wins resolver used for MCP, with executable type `bin`. Invocation flags MUST apply only after that ladder: deny/withhold from the ladder wins; `--trust-bin` MUST NOT invent a parallel allow store; `--no-trust-bin` MUST force skip when the ladder would allow. Bin grants MUST be expressed under the same `executables` manifest/user-store key as MCP grants.

#### Scenario: Project bin allow satisfies non-interactive without flag

- **WHEN** the project manifest lists the package under `executables.allow` with `bin: true` (or equivalent typed grant) and non-interactive install runs without `--trust-bin`
- **THEN** the shared resolver MUST return allow for `bin` and bin deploy MUST remain eligible subject to `--no-trust-bin`

#### Scenario: Org deny beats --trust-bin

- **WHEN** org policy denies the package (or deny_all) and install passes `--trust-bin`
- **THEN** the effective decision MUST remain deny/withhold for bin deploy
