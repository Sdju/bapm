# target-package-architecture Specification

## Purpose

Locks the bapm product decision that **in-tree APM-style client adapters are not a parity goal**. Integration capabilities live in separate packages, with a shared integration API package between integrations and `@bapm/core`.

## Requirements

### Requirement: No in-core or in-CLI integration adapter parity with APM

bapm MUST NOT treat microsoft/apm's in-tree `adapters/client/` catalog as a feature-parity checklist for `packages/core` or `packages/cli`. Core and CLI MUST NOT accumulate Cursor/Copilot/Claude (or other host) materialization adapters as first-class monolith modules analogous to APM.

#### Scenario: Roadmap excludes APM adapter-catalog parity

- **WHEN** planning install or deploy work
- **THEN** success criteria MUST be expressed as core↔integration API contracts and optional published `bapm-integration-*` packages, NOT as “match APM's N built-in adapters inside core/cli”

### Requirement: Dedicated integration implementation packages

Each concrete host integration MUST live in its own package named `bapm-integration-<id>` (for example, `bapm-integration-cursor`), containing the information and logic for every runtime and marketplace-output capability that package provides. Integration packages MUST depend on the shared integration API package for types and utilities, and `@bapm/core` MUST NOT embed host-specific deploy or marketplace-output logic.

#### Scenario: Cursor materialization is a separate package

- **WHEN** Cursor runtime deploy support is available
- **THEN** it MUST be packaged as `bapm-integration-cursor`, not as a core adapter or a legacy-named package

### Requirement: Shared integration API package as core↔integration boundary

The monorepo MUST include `bapm-integration-api`, which provides TypeScript capability contracts and registration utilities as the only layer between `@bapm/core` and concrete integrations. Core MUST use registration and capability discovery without importing a concrete integration package.

#### Scenario: Core does not import a concrete target package

- **WHEN** `@bapm/core` needs to invoke or describe host behavior
- **THEN** it MUST depend only on `bapm-integration-api` contracts and MUST NOT hard-depend on a specific integration implementation

### Requirement: All integration-related packages use vite-plus and TypeScript

`bapm-integration-api`, every `bapm-integration-*`, and other workspace packages in this architecture MUST be TypeScript ESM packages built and checked with vite-plus.

#### Scenario: New target package toolchain

- **WHEN** an integration package is added to the workspace
- **THEN** it MUST use TypeScript and vite-plus scripts/tooling consistent with the workspace

### Requirement: Deferred scaffolding

Creating `bapm-integration-api` / `bapm-target-*` packages, wiring workspace entries, and implementing materialization MUST wait for an explicit OpenSpec change (or equivalent implementation task). The capability record alone MUST NOT create those packages. Change `m4-install-materialize` IS that explicit change and MUST perform the scaffolding for `bapm-integration-api` and minimal `bapm-integration-cursor`. Further `bapm-target-*` hosts beyond cursor remain deferred to later changes.

#### Scenario: Spec exists without packages on disk before M4 apply

- **WHEN** this capability is present in `openspec/specs/target-package-architecture` and `m4-install-materialize` has not yet been applied
- **THEN** the repository MAY still lack `packages/integration-api` / `packages/target-*` until that change implements them

#### Scenario: M4 change is the scaffolding trigger

- **WHEN** `m4-install-materialize` is applied
- **THEN** scaffolding of `bapm-integration-api` and `bapm-integration-cursor` MUST proceed as part of that change, and additional host targets beyond cursor MUST remain deferred

### Requirement: M4 scaffolds target-api and target-cursor packages

This change MUST create workspace packages at `packages/integration-api` (name `bapm-integration-api`) and `packages/integration-cursor` (name `bapm-integration-cursor`), wire them into the pnpm workspace via pnpm CLI as needed, and implement materialization contracts as specified by `target-api-contracts` and `target-cursor-minimal`. Recording architecture alone is no longer sufficient once this change is applied.

#### Scenario: Packages exist after M4 apply

- **WHEN** change `m4-install-materialize` is implemented
- **THEN** `packages/integration-api` and `packages/integration-cursor` MUST exist on disk with the required package names and vite-plus TypeScript toolchain

### Requirement: M5 ships only target-api and target-cursor among bapm-target packages

For change `m5-cursor-install-polish`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-integration-api` and `bapm-integration-cursor`. The change MUST NOT scaffold, publish, or add workspace members such as `bapm-target-copilot`, `bapm-target-claude`, or any other `bapm-target-*` host. Multi-adapter catalog parity with APM `adapters/client/` remains a non-goal.

#### Scenario: No second host package on disk

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-integration-api` and `bapm-integration-cursor`

### Requirement: Core tests must not path-alias concrete cursor package

`@bapm/core` test/vite configuration MUST NOT use a path alias that remaps `bapm-integration-cursor` to a filesystem entry under `packages/integration-cursor` as a substitute for package resolution. Optional e2e that needs cursor MUST resolve it via workspace protocol / standard Node resolution from a package that is allowed to depend on cursor (CLI or a dedicated test harness), or avoid importing cursor from core entirely by using a mock target registered through `bapm-integration-api`.

#### Scenario: No vite cursor alias in core

- **WHEN** inspecting `packages/core` vite/test resolve aliases after this change
- **THEN** there MUST be no alias entry whose purpose is to redirect `bapm-integration-cursor` into the monorepo source tree for core tests

### Requirement: M6 ships only target-api and target-cursor among bapm-target packages

For change `m6-lifecycle-integrity`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-integration-api` and `bapm-integration-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core` and the CLI (`bapm`); target packages MAY be touched only for incidental hash/cleanup needs.

#### Scenario: No second host package after M6

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-integration-api` and `bapm-integration-cursor`

### Requirement: M7 ships only target-api and target-cursor among bapm-target packages

For change `m7-producer-toolchain`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-integration-api` and `bapm-integration-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core` and the CLI (`bapm`); target packages MUST NOT be required for init/pack/release-check success.

#### Scenario: No second host package after M7

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-integration-api` and `bapm-integration-cursor`

### Requirement: M8 ships only target-api and target-cursor among bapm-target packages

For change `m8-governance-policy`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-integration-api` and `bapm-integration-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core` and the CLI (`bapm`); target packages MUST NOT be required for policy parse/gate success and MUST NOT gain policy-specific host adapters.

#### Scenario: No second host package after M8

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-integration-api` and `bapm-integration-cursor`

### Requirement: M9 ships only target-api and target-cursor among bapm-target packages

For change `m9-apm-extras`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-integration-api` and `bapm-integration-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core`, the CLI (`bapm`), and `bapm-integration-cursor` (MCP write path); `bapm-integration-api` MAY gain an optional host-agnostic MCP configure contract. Multi-host compile adapters remain a non-goal.

#### Scenario: No second host package after M9

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-integration-api` and `bapm-integration-cursor`

### Requirement: M10 ships only target-api and target-cursor among bapm-target packages

For change `m10-registry-distribution`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-integration-api` and `bapm-integration-cursor`. The change MUST NOT scaffold, publish, or add workspace members for any additional `bapm-target-*` host. Primary implementation packages are `@bapm/core` and the CLI (`bapm`); target packages MUST NOT be required for registry client, publish, or self-update success and SHOULD remain untouched.

#### Scenario: No second host package after M10

- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-integration-api` and `bapm-integration-cursor`

### Requirement: Concrete targets own host layout and compile emission

Each concrete `bapm-target-<id>` package MUST own its host-specific detection signals, deploy layout, primitive materialization mapping, MCP configuration layout, and compile output rendering/default path. `@bapm/core` and the CLI composition root MUST use only generic target-api contracts for these operations and MUST NOT contain Cursor-specific compile rendering, `AGENTS.md` defaulting, deploy-path attribution, or target-id allowlists.

#### Scenario: Cursor layout remains in cursor target package

- **WHEN** inspecting the implementation of Cursor detection, deploy mapping, MCP path reporting, and compile output after this change
- **THEN** Cursor-specific layout and rendering logic MUST reside in `bapm-integration-cursor`, not in `@bapm/core` or the CLI command implementation

### Requirement: Composition root registers available target packages

The application composition root MUST register target packages available to its distribution into a shared target registry before passing that registry to core compile or install orchestration. Core MUST remain independent of concrete target package imports, and tests MUST be able to provide a registry containing arbitrary target doubles.

#### Scenario: CLI registers packaged targets outside core

- **WHEN** CLI runs compile or install in a distribution containing `bapm-integration-cursor`
- **THEN** the composition root MUST register Cursor before invoking core, while `@bapm/core` MUST not import that package

### Requirement: Live architecture uses only integration terminology

Live architecture documentation and specifications MUST describe concrete host packages as integrations and the shared boundary as the integration API. Historical migration references may name the retired namespace only in the migration's archived record; live specifications MUST NOT retain it.

#### Scenario: Architecture specification audit

- **WHEN** maintainers inspect live architecture specifications after the migration
- **THEN** they find integration package terminology and no retired target package identifier
