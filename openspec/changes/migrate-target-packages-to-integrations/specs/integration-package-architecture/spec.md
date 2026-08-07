## Purpose

Defines the package boundary that lets host integrations provide runtime and marketplace-output capabilities without leaking host-specific behavior into core.

## ADDED Requirements

### Requirement: Integration packages own host capabilities
Each host integration SHALL be published as `bapm-integration-<id>`. An integration MAY provide runtime capabilities (detection, primitive deployment, MCP configuration, or compile emission), marketplace-output capabilities, or both. It MUST own every host-specific layout, document shape, default path, and mapping used by the capabilities it provides.

#### Scenario: A host capability is selected
- **WHEN** a distribution selects a registered host integration for runtime or marketplace output work
- **THEN** the selected integration supplies the host-specific behavior and `@bapm/core` uses only generic capability contracts

### Requirement: No legacy target package compatibility
The workspace SHALL contain no package, package alias, re-export shim, resolver alias, source import, documentation reference, OpenSpec requirement, fixture, test assertion, or generated artifact that identifies a package as `bapm-target-api` or `bapm-target-*`. The migration MUST NOT provide compatibility adapters or aliases for these names.

#### Scenario: Legacy namespace audit
- **WHEN** the repository is audited after migration, excluding immutable git history and explicitly archived historical OpenSpec snapshots
- **THEN** no live workspace file or package-resolution result contains `bapm-target-`

### Requirement: Migration phases have independently verifiable completion
The migration SHALL complete in ordered phases: generic API rename, Cursor runtime migration, Claude and Codex marketplace-output migration, then exhaustive legacy eradication. A later phase MUST NOT be declared complete until the preceding phase's package graph, capability behavior, and legacy-name checks pass.

#### Scenario: Marketplace phase follows runtime rename
- **WHEN** Claude or Codex marketplace output ownership is migrated
- **THEN** `bapm-integration-api` and the Cursor runtime package graph already resolve without any legacy target package names
