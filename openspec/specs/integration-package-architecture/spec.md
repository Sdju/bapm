# integration-package-architecture Specification

## Purpose

Defines the package boundary that lets host integrations provide runtime and marketplace-output capabilities without leaking host-specific behavior into core.

## Requirements

### Requirement: Integration packages own host capabilities

Each host integration SHALL be published as `bapm-integration-<id>`. An integration MAY provide runtime capabilities (detection, primitive deployment, MCP configuration, or compile emission), marketplace-output capabilities, or both. It MUST own every host-specific layout, document shape, default path, and mapping used by the capabilities it provides.

#### Scenario: A host capability is selected

- **WHEN** a distribution selects a registered host integration for runtime or marketplace output work
- **THEN** the selected integration supplies the host-specific behavior and `@bapm/core` uses only generic capability contracts

### Requirement: No legacy target package compatibility

The public workspace package graph SHALL expose `bapm-integration-api` and concrete `bapm-integration-*` packages as the integration boundary. Retired `bapm-target-*` package specifiers MUST fail package resolution. The migration MUST NOT provide a legacy package, package alias, re-export shim, resolver alias, or compatibility adapter for retired specifiers.

#### Scenario: Legacy package resolution is rejected

- **WHEN** a consumer resolves a retired `bapm-target-*` package specifier after migration
- **THEN** resolution fails, while `bapm-integration-api` and the required concrete `bapm-integration-*` packages resolve to their published identities

### Requirement: Migration phases have independently verifiable completion

The migration SHALL complete in ordered phases: generic API rename, Cursor runtime migration, Claude and Codex marketplace-output migration, then exhaustive legacy eradication. A later phase MUST NOT be declared complete until the preceding phase's package graph, capability behavior, and legacy-name checks pass.

#### Scenario: Marketplace phase follows runtime rename

- **WHEN** Claude or Codex marketplace output ownership is migrated
- **THEN** `bapm-integration-api` and the Cursor runtime package graph already resolve without any legacy target package names
