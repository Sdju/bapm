## ADDED Requirements

### Requirement: M9 ships only target-api and target-cursor among bapm-target packages

For change `m9-apm-extras`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-target-api` and `bapm-target-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core`, the CLI (`bapm`), and `bapm-target-cursor` (MCP write path); `bapm-target-api` MAY gain an optional host-agnostic MCP configure contract. Multi-host compile adapters remain a non-goal.

#### Scenario: No second host package after M9

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-target-api` and `bapm-target-cursor`
