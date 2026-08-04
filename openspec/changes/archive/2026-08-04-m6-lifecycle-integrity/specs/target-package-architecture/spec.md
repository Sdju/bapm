## ADDED Requirements

### Requirement: M6 ships only target-api and target-cursor among bapm-target packages
For change `m6-lifecycle-integrity`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-target-api` and `bapm-target-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core` and the CLI (`bapm`); target packages MAY be touched only for incidental hash/cleanup needs.

#### Scenario: No second host package after M6
- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-target-api` and `bapm-target-cursor`
