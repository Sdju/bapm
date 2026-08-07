## MODIFIED Requirements

### Requirement: Install selects only an unambiguous registered target
For install materialization and MCP configuration, core MUST evaluate target detection through the registered integration registry. When exactly one registered integration is detected, install MUST select that target automatically. When zero or more than one registered integrations are detected, install MUST require an explicit registered target id and MUST fail before target harness writes if none is supplied. An explicit registered target MUST override automatic detection; an unknown id MUST fail closed.

#### Scenario: Sole detected target deploys automatically
- **WHEN** install runs without an explicit target and exactly one registered integration positively detects the project
- **THEN** install MUST invoke that integration's eligible materialize and MCP capabilities

#### Scenario: No target detection requires explicit target
- **WHEN** install runs without an explicit target and no registered integrations positively detect the project
- **THEN** install MUST fail with guidance to pass `--target <id>` and MUST NOT write target harness files

#### Scenario: Ambiguous target detection requires explicit target
- **WHEN** install runs without an explicit target and two or more registered integrations positively detect the project
- **THEN** install MUST fail with guidance to pass `--target <id>` and MUST NOT write target harness files

### Requirement: Exclude validation derives from registered targets
Install MUST validate each `--exclude` target/runtime id against the registered integration registry rather than a concrete Cursor allowlist. A registered id is valid even when it is not the selected active target; an unregistered id MUST fail closed before target configuration writes. Exclusion MUST continue to suppress only the excluded target's eligible runtime configuration, not the entire install.

#### Scenario: Registered non-Cursor exclude is accepted
- **WHEN** install receives an exclude id for a registered non-Cursor integration
- **THEN** validation MUST accept the id without core containing host-specific allowlist knowledge

#### Scenario: Unregistered exclude is rejected
- **WHEN** install receives an exclude id absent from the integration registry
- **THEN** install MUST fail with a clear error before target configuration writes
