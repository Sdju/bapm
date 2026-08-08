## ADDED Requirements

### Requirement: Target contracts stay free of dry-run

`bapm-target-api` contracts for `materialize`, optional MCP configure, detection, and registration MUST NOT add a `dryRun` (or equivalent) parameter or require targets to branch on dry-run. Dry-run zero-write behavior MUST be enforced only by core/CLI orchestration (skipping write ports or substituting a core-boundary no-op), never by teaching concrete targets about dry-run.

#### Scenario: Public target types omit dryRun

- **WHEN** inspecting public `bapm-target-api` TypeScript contracts for materialize and configureMcp contexts
- **THEN** those contracts MUST NOT require or expose a dry-run flag for target implementers

#### Scenario: Cursor target unchanged for dry-run

- **WHEN** dry-run install is executed with cursor registered
- **THEN** `bapm-target-cursor` MUST NOT need dry-run-specific code paths; write ports simply MUST NOT be invoked (or MUST be wrapped only outside the target package)
