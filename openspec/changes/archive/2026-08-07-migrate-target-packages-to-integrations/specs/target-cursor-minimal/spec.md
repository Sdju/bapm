## MODIFIED Requirements

### Requirement: Package @b-apm/integration-cursor exists and depends only on target-api

The monorepo MUST include package directory `packages/integration-cursor` with package name `@b-apm/integration-cursor`. The package MUST be TypeScript ESM with vite-plus tooling. Among bapm packages it MUST depend on `@b-apm/integration-api` for types and contracts and MUST NOT require `@b-apm/core` as a hard dependency for host capability implementation.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the Cursor package dependencies after migration
- **THEN** `@b-apm/integration-cursor` depends on `@b-apm/integration-api` and does not reverse-depend on `@b-apm/core` for its host behavior

### Requirement: Not imported by core

`@b-apm/core` MUST NOT hard-depend on or statically import `@b-apm/integration-cursor`. Registration for CLI or e2e MUST occur in a composition root or test harness through the integration API registry.

#### Scenario: Core package graph excludes cursor

- **WHEN** inspecting `@b-apm/core` dependencies
- **THEN** `@b-apm/integration-cursor` does not appear as a dependency

## ADDED Requirements

### Requirement: Cursor behavior survives package migration

The Cursor integration MUST preserve the existing documented detection, primitive deployment, MCP configuration, compile-emission, path-safety, and inventory-report behavior through the integration capability contracts.

#### Scenario: Cursor runtime capabilities are migrated

- **WHEN** install or compile selects registered Cursor behavior after migration
- **THEN** the observable files, registered-root safety, and reports are equivalent to the pre-migration behavior while all resolved package identifiers use the integration namespace
