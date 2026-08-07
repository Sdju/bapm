## MODIFIED Requirements

### Requirement: Package bapm-integration-cursor exists and depends only on target-api

The monorepo MUST include package directory `packages/integration-cursor` with package name `bapm-integration-cursor`. The package MUST be TypeScript ESM with vite-plus tooling. Among bapm packages it MUST depend on `bapm-integration-api` for types and contracts and MUST NOT require `@bapm/core` as a hard dependency for host capability implementation.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting the Cursor package dependencies after migration
- **THEN** `bapm-integration-cursor` depends on `bapm-integration-api` and does not reverse-depend on `@bapm/core` for its host behavior

### Requirement: Not imported by core

`@bapm/core` MUST NOT hard-depend on or statically import `bapm-integration-cursor`. Registration for CLI or e2e MUST occur in a composition root or test harness through the integration API registry.

#### Scenario: Core package graph excludes cursor

- **WHEN** inspecting `@bapm/core` dependencies
- **THEN** `bapm-integration-cursor` does not appear as a dependency

## ADDED Requirements

### Requirement: Cursor behavior survives package migration

The Cursor integration MUST preserve the existing documented detection, primitive deployment, MCP configuration, compile-emission, path-safety, and inventory-report behavior through the integration capability contracts.

#### Scenario: Cursor runtime capabilities are migrated

- **WHEN** install or compile selects registered Cursor behavior after migration
- **THEN** the observable files, registered-root safety, and reports are equivalent to the pre-migration behavior while all resolved package identifiers use the integration namespace
