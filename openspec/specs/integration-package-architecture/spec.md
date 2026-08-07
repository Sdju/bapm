# integration-package-architecture Specification

## Purpose

Defines the package boundary that lets host integrations provide runtime and marketplace-output capabilities without leaking host-specific behavior into core. Locks the product decision that in-tree APM-style client adapters are not a parity goal.

## Requirements

### Requirement: Canonical integration architecture is the only active architecture authority

`integration-package-architecture` MUST be the sole active architecture specification for the integration boundary. Its requirements MUST retain the enduring constraints that host-specific behavior lives in `@bapm/integration-*` packages, `@bapm/integration-api` is the core-to-integration boundary, and core does not import concrete integrations. The retired `target-package-architecture` specification MUST not remain active.

#### Scenario: Maintainer consults active architecture guidance

- **WHEN** a maintainer consults active OpenSpec architecture guidance for a host capability
- **THEN** the canonical integration architecture specification defines the package boundary without requiring a superseded target-package architecture specification

### Requirement: No in-core or in-CLI integration adapter parity with APM

bapm MUST NOT treat microsoft/apm's in-tree `adapters/client/` catalog as a feature-parity checklist for `packages/core` or `packages/cli`. Core and CLI MUST NOT accumulate Cursor/Copilot/Claude (or other host) materialization adapters as first-class monolith modules analogous to APM.

#### Scenario: Roadmap excludes APM adapter-catalog parity

- **WHEN** planning install or deploy work
- **THEN** success criteria MUST be expressed as core↔integration API contracts and optional published `@bapm/integration-*` packages, NOT as “match APM's N built-in adapters inside core/cli”

### Requirement: Integration packages own host capabilities

Each host integration SHALL be published as `@bapm/integration-<id>`. An integration MAY provide runtime capabilities (detection, primitive deployment, MCP configuration, or compile emission), marketplace-output capabilities, or both. It MUST own every host-specific layout, document shape, default path, and mapping used by the capabilities it provides. Integration packages MUST depend on the shared integration API package for types and utilities, and `@bapm/core` MUST NOT embed host-specific deploy or marketplace-output logic.

#### Scenario: A host capability is selected

- **WHEN** a distribution selects a registered host integration for runtime or marketplace output work
- **THEN** the selected integration supplies the host-specific behavior and `@bapm/core` uses only generic capability contracts

#### Scenario: Cursor materialization is a separate package

- **WHEN** Cursor runtime deploy support is available
- **THEN** it MUST be packaged as `@bapm/integration-cursor`, not as a core adapter or a legacy-named package

### Requirement: Shared integration API package as core↔integration boundary

The monorepo MUST include `@bapm/integration-api`, which provides TypeScript capability contracts and registration utilities as the only layer between `@bapm/core` and concrete integrations. Core MUST use registration and capability discovery without importing a concrete integration package.

#### Scenario: Core does not import a concrete integration package

- **WHEN** `@bapm/core` needs to invoke or describe host behavior
- **THEN** it MUST depend only on `@bapm/integration-api` contracts and MUST NOT hard-depend on a specific integration implementation

### Requirement: All integration-related packages use vite-plus and TypeScript

`@bapm/integration-api`, every `@bapm/integration-*`, and other workspace packages in this architecture MUST be TypeScript ESM packages built and checked with vite-plus.

#### Scenario: New integration package toolchain

- **WHEN** an integration package is added to the workspace
- **THEN** it MUST use TypeScript and vite-plus scripts/tooling consistent with the workspace

### Requirement: Core tests must not path-alias concrete cursor package

`@bapm/core` test/vite configuration MUST NOT use a path alias that remaps `@bapm/integration-cursor` to a filesystem entry under `packages/integration-cursor` as a substitute for package resolution. Optional e2e that needs cursor MUST resolve it via workspace protocol / standard Node resolution from a package that is allowed to depend on cursor (CLI or a dedicated test harness), or avoid importing cursor from core entirely by using a mock integration registered through `@bapm/integration-api`.

#### Scenario: No vite cursor alias in core

- **WHEN** inspecting `packages/core` vite/test resolve aliases after this change
- **THEN** there MUST be no alias entry whose purpose is to redirect `@bapm/integration-cursor` into the monorepo source tree for core tests

### Requirement: Concrete integrations own host layout and compile emission

Each concrete `@bapm/integration-<id>` package MUST own its host-specific detection signals, deploy layout, primitive materialization mapping, MCP configuration layout, and compile output rendering/default path. `@bapm/core` and the CLI composition root MUST use only generic integration-api contracts for these operations and MUST NOT contain Cursor-specific compile rendering, `AGENTS.md` defaulting, deploy-path attribution, or integration-id allowlists.

#### Scenario: Cursor layout remains in cursor integration package

- **WHEN** inspecting the implementation of Cursor detection, deploy mapping, MCP path reporting, and compile output after this change
- **THEN** Cursor-specific layout and rendering logic MUST reside in `@bapm/integration-cursor`, not in `@bapm/core` or the CLI command implementation

### Requirement: Composition root registers available integration packages

The application composition root MUST register integration packages available to its distribution into a shared integration registry before passing that registry to core compile or install orchestration. Core MUST remain independent of concrete integration package imports, and tests MUST be able to provide a registry containing arbitrary integration doubles.

#### Scenario: CLI registers packaged integrations outside core

- **WHEN** CLI runs compile or install in a distribution containing `@bapm/integration-cursor`
- **THEN** the composition root MUST register Cursor before invoking core, while `@bapm/core` MUST not import that package

### Requirement: No legacy target package compatibility

The public workspace package graph SHALL expose `@bapm/integration-api` and concrete `@bapm/integration-*` packages as the integration boundary. Retired `bapm-target-*` package specifiers MUST fail package resolution. The migration MUST NOT provide a legacy package, package alias, re-export shim, resolver alias, or compatibility adapter for retired specifiers.

#### Scenario: Legacy package resolution is rejected

- **WHEN** a consumer resolves a retired `bapm-target-*` package specifier after migration
- **THEN** resolution fails, while `@bapm/integration-api` and the required concrete `@bapm/integration-*` packages resolve to their published identities

### Requirement: Live architecture uses only integration terminology

Live architecture documentation and specifications MUST describe concrete host packages as integrations and the shared boundary as the integration API. Historical migration references may name the retired namespace only in the migration's archived record; live specifications MUST NOT retain it.

#### Scenario: Architecture specification audit

- **WHEN** maintainers inspect live architecture specifications after the migration
- **THEN** they find integration package terminology and no retired target package identifier
