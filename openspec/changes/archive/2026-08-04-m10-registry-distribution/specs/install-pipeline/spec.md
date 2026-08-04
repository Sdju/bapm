## ADDED Requirements

### Requirement: Install materializes registry packages after policy gate
When the resolved set includes registry-sourced packages, install MUST materialize verified registry archives into the modules directory using the registry-resolve-install path (lk-013 before extract). The M8 policy gate MUST still run before durable modules/lock/deploy writes. Git/local-only installs MUST remain unchanged.

#### Scenario: Registry install places modules with verified hash
- **WHEN** non-frozen install runs with a registry dep against a mock registry that serves matching digest bytes
- **THEN** the package MUST be present under modules and the lock MUST record `resolved_hash` matching those bytes

#### Scenario: Policy still blocks registry dep before writes
- **WHEN** install proposes a registry dep denied by policy in block mode
- **THEN** install MUST fail closed before modules/lock durable writes for that plan

#### Scenario: Digest mismatch leaves modules unchanged
- **WHEN** registry download bytes do not match advertised digest during install
- **THEN** install MUST fail closed and MUST NOT leave a successful partial extract for that package
