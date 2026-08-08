## ADDED Requirements

### Requirement: M5 ships only target-api and target-cursor among bapm-target packages

For change `m5-cursor-install-polish`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-target-api` and `bapm-target-cursor`. The change MUST NOT scaffold, publish, or add workspace members such as `bapm-target-copilot`, `bapm-target-claude`, or any other `bapm-target-*` host. Multi-adapter catalog parity with APM `adapters/client/` remains a non-goal.

#### Scenario: No second host package on disk

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-target-api` and `bapm-target-cursor`

### Requirement: Core tests must not path-alias concrete cursor package

`@bapm/core` test/vite configuration MUST NOT use a path alias that remaps `bapm-target-cursor` to a filesystem entry under `packages/target-cursor` as a substitute for package resolution. Optional e2e that needs cursor MUST resolve it via workspace protocol / standard Node resolution from a package that is allowed to depend on cursor (CLI or a dedicated test harness), or avoid importing cursor from core entirely by using a mock target registered through `bapm-target-api`.

#### Scenario: No vite cursor alias in core

- **WHEN** inspecting `packages/core` vite/test resolve aliases after this change
- **THEN** there MUST be no alias entry whose purpose is to redirect `bapm-target-cursor` into the monorepo source tree for core tests
