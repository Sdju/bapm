## ADDED Requirements

### Requirement: Install selects only an unambiguous registered target
For install materialization and MCP configuration, core MUST evaluate target detection through the registered target registry. When exactly one registered target is detected, install MUST select that target automatically. When zero or more than one registered targets are detected, install MUST require an explicit registered target id and MUST fail before target harness writes if none is supplied. An explicit registered target MUST override automatic detection; an unknown id MUST fail closed.

#### Scenario: Sole detected target deploys automatically
- **WHEN** install runs without an explicit target and exactly one registered target positively detects the project
- **THEN** install MUST invoke that target's eligible materialize and MCP capabilities

#### Scenario: No target detection requires explicit target
- **WHEN** install runs without an explicit target and no registered target positively detects the project
- **THEN** install MUST fail with guidance to pass `--target <id>` and MUST NOT write target harness files

#### Scenario: Ambiguous target detection requires explicit target
- **WHEN** install runs without an explicit target and two or more registered targets positively detect the project
- **THEN** install MUST fail with guidance to pass `--target <id>` and MUST NOT write target harness files

### Requirement: Exclude validation derives from registered targets
Install MUST validate each `--exclude` target/runtime id against the registered target registry rather than a concrete Cursor allowlist. A registered id is valid even when it is not the selected active target; an unregistered id MUST fail closed before target configuration writes. Exclusion MUST continue to suppress only the excluded target's eligible runtime configuration, not the entire install.

#### Scenario: Registered non-Cursor exclude is accepted
- **WHEN** install receives an exclude id for a registered non-Cursor target
- **THEN** validation MUST accept the id without core containing host-specific allowlist knowledge

#### Scenario: Unregistered exclude is rejected
- **WHEN** install receives an exclude id absent from the target registry
- **THEN** install MUST fail with a clear error before target configuration writes

### Requirement: Core attributes deployment only from target reports
Core MUST build deployed-file and MCP configuration inventory from paths, hashes, and ownership reported by selected registered target capabilities. Core MUST NOT synthesize a concrete target path, filename, target id, or primitive-to-layout attribution as a fallback. Missing required deployment reporting from a selected capability MUST fail closed rather than record an invented concrete-host inventory.

#### Scenario: Target report drives deployed-file lock attribution
- **WHEN** a selected target materializes primitives and reports deployment entries
- **THEN** lock deployment inventory MUST be attributed from that report without Cursor-specific path derivation in core

#### Scenario: Missing required report does not use Cursor fallback
- **WHEN** a selected target writes or claims to write deploy output but omits required deployment attribution
- **THEN** install MUST fail clearly or omit only the unsupported operation according to the capability contract, and MUST NOT infer a Cursor path or inventory entry
