# target-package-architecture Specification

## Purpose

Locks the bapm product decision that **in-tree APM-style client adapters are not a parity goal**. Target materialization lives in separate packages, with a shared API package between targets and `@bapm/core`. This capability is architectural requirements only; packages MUST NOT be scaffolded until a dedicated change implements them.

## Requirements

### Requirement: No in-core or in-CLI target adapter parity with APM
bapm MUST NOT treat microsoft/apm's in-tree `adapters/client/` catalog as a feature-parity checklist for `packages/core` or `packages/cli`. Core and CLI MUST NOT accumulate Cursor/Copilot/Claude (or other host) materialization adapters as first-class monolith modules analogous to APM.

#### Scenario: Roadmap excludes APM adapter-catalog parity
- **WHEN** planning M4–M5 or later install/deploy work
- **THEN** success criteria MUST be expressed as core↔target-api contracts and optional published `bapm-target-*` packages, NOT as “match APM's N built-in adapters inside core/cli”

### Requirement: Dedicated target implementation packages
Each concrete host/target materialization MUST live in its own package named `bapm-target-<id>` (example: `bapm-target-cursor`), containing the information and logic needed to materialize into that host. Target packages MUST depend on the shared target API package for types and utilities, and MUST NOT embed host-specific deploy logic inside `@bapm/core`.

#### Scenario: Cursor materialization is a separate package
- **WHEN** Cursor deploy support is introduced
- **THEN** it MUST be packaged as `bapm-target-cursor` (or equivalent scoped name under the repo workspace), not as `packages/core/src/adapters/cursor`

### Requirement: Shared target API package as core↔target boundary
The monorepo MUST include (when implemented) a package `bapm-target-api` that provides TypeScript typing and utilities for targets and acts as the **layer between target packages and `@bapm/core`**. Core MUST speak to targets through this API boundary (registration/discovery/contracts), not by importing concrete `bapm-target-*` internals.

#### Scenario: Core does not import a concrete target package
- **WHEN** `@bapm/core` needs to invoke or describe target materialization
- **THEN** it MUST depend only on `bapm-target-api` contracts (or dynamic registration via that API), and MUST NOT hard-depend on a specific `bapm-target-*` implementation package

### Requirement: All target-related packages use vite-plus and TypeScript
`bapm-target-api`, every `bapm-target-*`, and other workspace packages in this architecture MUST be **TypeScript (ESM)** packages built and checked with **vite-plus** (`vp`), consistent with existing `packages/core` and `packages/cli`.

#### Scenario: New target package toolchain
- **WHEN** a `bapm-target-*` or `bapm-target-api` package is added to the workspace
- **THEN** it MUST use TypeScript and vite-plus scripts/tooling (`vp pack` / `vp test` / `vp check` as applicable), not a divergent Python or non-TS stack

### Requirement: Deferred scaffolding
Creating `bapm-target-api` / `bapm-target-*` packages, wiring workspace entries, and implementing materialization MUST wait for an explicit OpenSpec change (or equivalent implementation task). The capability record alone MUST NOT create those packages. Change `m4-install-materialize` IS that explicit change and MUST perform the scaffolding for `bapm-target-api` and minimal `bapm-target-cursor`. Further `bapm-target-*` hosts beyond cursor remain deferred to later changes.

#### Scenario: Spec exists without packages on disk before M4 apply
- **WHEN** this capability is present in `openspec/specs/target-package-architecture` and `m4-install-materialize` has not yet been applied
- **THEN** the repository MAY still lack `packages/target-api` / `packages/target-*` until that change implements them

#### Scenario: M4 change is the scaffolding trigger
- **WHEN** `m4-install-materialize` is applied
- **THEN** scaffolding of `bapm-target-api` and `bapm-target-cursor` MUST proceed as part of that change, and additional host targets beyond cursor MUST remain deferred

### Requirement: M4 scaffolds target-api and target-cursor packages
This change MUST create workspace packages at `packages/target-api` (name `bapm-target-api`) and `packages/target-cursor` (name `bapm-target-cursor`), wire them into the pnpm workspace via pnpm CLI as needed, and implement materialization contracts as specified by `target-api-contracts` and `target-cursor-minimal`. Recording architecture alone is no longer sufficient once this change is applied.

#### Scenario: Packages exist after M4 apply
- **WHEN** change `m4-install-materialize` is implemented
- **THEN** `packages/target-api` and `packages/target-cursor` MUST exist on disk with the required package names and vite-plus TypeScript toolchain

### Requirement: M5 ships only target-api and target-cursor among bapm-target packages
For change `m5-cursor-install-polish`, the workspace MUST contain among packages named `bapm-target-*` only `bapm-target-api` and `bapm-target-cursor`. The change MUST NOT scaffold, publish, or add workspace members such as `bapm-target-copilot`, `bapm-target-claude`, or any other `bapm-target-*` host. Multi-adapter catalog parity with APM `adapters/client/` remains a non-goal.

#### Scenario: No second host package on disk
- **WHEN** listing workspace packages matching `bapm-target-*` after this change is applied
- **THEN** the only matches MUST be `bapm-target-api` and `bapm-target-cursor`

### Requirement: Core tests must not path-alias concrete cursor package
`@bapm/core` test/vite configuration MUST NOT use a path alias that remaps `bapm-target-cursor` to a filesystem entry under `packages/target-cursor` as a substitute for package resolution. Optional e2e that needs cursor MUST resolve it via workspace protocol / standard Node resolution from a package that is allowed to depend on cursor (CLI or a dedicated test harness), or avoid importing cursor from core entirely by using a mock target registered through `bapm-target-api`.

#### Scenario: No vite cursor alias in core
- **WHEN** inspecting `packages/core` vite/test resolve aliases after this change
- **THEN** there MUST be no alias entry whose purpose is to redirect `bapm-target-cursor` into the monorepo source tree for core tests
