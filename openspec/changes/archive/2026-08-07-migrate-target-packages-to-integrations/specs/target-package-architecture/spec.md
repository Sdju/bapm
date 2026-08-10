## MODIFIED Requirements

### Requirement: Dedicated target implementation packages

Each concrete host integration MUST live in its own package named `@b-apm/integration-<id>` (for example, `@b-apm/integration-cursor`), containing the information and logic for every runtime and marketplace-output capability that package provides. Integration packages MUST depend on the shared integration API package for types and utilities, and `@b-apm/core` MUST NOT embed host-specific deploy or marketplace-output logic.

#### Scenario: Cursor integration is a separate package

- **WHEN** Cursor runtime deploy support is available
- **THEN** it MUST be packaged as `@b-apm/integration-cursor`, not as a core adapter or a legacy-named package

### Requirement: Shared target API package as core↔target boundary

The monorepo MUST include `@b-apm/integration-api`, which provides TypeScript capability contracts and registration utilities as the only layer between `@b-apm/core` and concrete integrations. Core MUST use registration and capability discovery without importing a concrete integration package.

#### Scenario: Core does not import a concrete integration package

- **WHEN** `@b-apm/core` needs to invoke or describe host behavior
- **THEN** it MUST depend only on `@b-apm/integration-api` contracts and MUST NOT hard-depend on a specific integration implementation

### Requirement: All target-related packages use vite-plus and TypeScript

`@b-apm/integration-api`, every `@b-apm/integration-*`, and other workspace packages in this architecture MUST be TypeScript ESM packages built and checked with vite-plus.

#### Scenario: New integration package toolchain

- **WHEN** an integration package is added to the workspace
- **THEN** it MUST use TypeScript and vite-plus scripts/tooling consistent with the workspace

## ADDED Requirements

### Requirement: Live architecture uses only integration terminology

Live architecture documentation and specifications MUST describe concrete host packages as integrations and the shared boundary as the integration API. Historical migration references may name the retired namespace only in the migration's archived record; live specifications MUST NOT retain it.

#### Scenario: Architecture specification audit

- **WHEN** maintainers inspect live architecture specifications after the migration
- **THEN** they find integration package terminology and no retired target package identifier
