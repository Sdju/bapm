## ADDED Requirements

### Requirement: Materialize may report deployed paths
`bapm-target-api` MUST allow a target `materialize` implementation to report the list of project-relative (or cwd-relative) file paths it wrote (and optionally content hashes) so core install can record lock inventory for orphan cleanup and frozen re-verify. The report MAY be a return value, an out-parameter on context, or an equivalent documented contract extension. Core MUST consume this report only through the api package, never by importing concrete `bapm-target-*` internals.

#### Scenario: Materialize report is available to core via api
- **WHEN** a registered target materializes primitives and writes harness files
- **THEN** consumers using only `bapm-target-api` MUST be able to obtain the set of deployed paths (and hashes when provided) without importing a concrete host package

### Requirement: No adapter catalog types in api
`bapm-target-api` MUST NOT introduce a multi-host adapter catalog, Copilot/Claude-specific contracts, or MCP client configure surface in this change. Extensions MUST stay generic for any registered target id.

#### Scenario: Api stays host-agnostic
- **WHEN** inspecting `bapm-target-api` public types after this change
- **THEN** there MUST be no second-host catalog or MCP-configure API required for M5 cursor polish
