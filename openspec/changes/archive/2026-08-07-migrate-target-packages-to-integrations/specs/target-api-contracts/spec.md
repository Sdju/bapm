## MODIFIED Requirements

### Requirement: Package @b-apm/integration-api exists with vite-plus TypeScript toolchain

The monorepo MUST include package directory `packages/integration-api` with package name `@b-apm/integration-api`. The package MUST be TypeScript ESM and MUST use vite-plus scripts/tooling consistent with `packages/core` and `packages/cli`.

#### Scenario: Package identity and toolchain

- **WHEN** inspecting the workspace after migration
- **THEN** `packages/integration-api` exists with name `@b-apm/integration-api` and exposes vite-plus build, test, and check scripts as applicable

### Requirement: Boundary-only dependency for core

`@b-apm/core` MUST depend on `@b-apm/integration-api` for speaking to integrations and MUST NOT import concrete `@b-apm/integration-*` package internals through this boundary.

#### Scenario: Core speaks only through integration api package

- **WHEN** `@b-apm/core` needs to describe or invoke a host capability
- **THEN** it MUST do so through `@b-apm/integration-api` contracts and registration only

## ADDED Requirements

### Requirement: Integration API exposes generic optional capabilities

`@b-apm/integration-api` MUST expose capability contracts for runtime deployment, MCP configuration, compile emission, and marketplace-output emission without encoding a fixed host catalog. Capability discovery and invocation MUST permit an integration to implement any supported subset.

#### Scenario: Marketplace-only integration is usable

- **WHEN** a registered Claude or Codex integration exposes marketplace-output emission but no runtime deployment capability
- **THEN** core can select its marketplace output capability without inferring or requiring runtime behavior

### Requirement: Integration API has no legacy package compatibility surface

The public API and workspace resolution graph MUST NOT expose legacy target package names, legacy module specifiers, or deprecated aliases.

#### Scenario: Legacy import is rejected

- **WHEN** a consumer or workspace source attempts to resolve a retired target package specifier
- **THEN** resolution fails because no alias or compatibility package is provided
