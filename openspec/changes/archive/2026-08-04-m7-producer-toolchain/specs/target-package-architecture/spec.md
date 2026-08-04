## ADDED Requirements

### Requirement: M7 ships only target-api and target-cursor among bapm-target packages
For change `m7-producer-toolchain`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-target-api` and `bapm-target-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core` and the CLI (`bapm`); target packages MUST NOT be required for init/pack/release-check success.

#### Scenario: No second host package after M7
- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-target-api` and `bapm-target-cursor`
