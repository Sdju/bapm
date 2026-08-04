# core-feod-architecture Specification

## Purpose

Defines the library FEOD layer layout and import boundaries for `@bapm/core` so domain modules stay isolated under a profile separate from the CLI, while the package public export surface remains stable.

## Requirements

### Requirement: Library FEOD layer directories exist under src
The `packages/core` package MUST organize source code under `src/` into the library FEOD layers: `app`, `modules`, `common`, `globals`, and an empty `pages` stub directory. The pages layer directory name MUST be `pages` (NOT `commands`). The `pages` directory MAY contain only a placeholder (for example `.gitkeep`) and MUST NOT host domain logic.

#### Scenario: Layer roots are present after migration
- **WHEN** the FEOD migration of `packages/core` is complete
- **THEN** `src/app`, `src/modules`, `src/common`, `src/globals`, and `src/pages` directories MUST exist under `packages/core`

#### Scenario: Pages stub has no domain logic
- **WHEN** inspecting `src/pages` after migration
- **THEN** it MUST NOT contain Manifest, Lockfile, or other domain implementation files

### Requirement: Path alias maps @ to src
The TypeScript configuration for `packages/core` MUST resolve the path alias `@/*` to `./src/*` so cross-level imports use `@/` rather than deep relative paths across layers.

#### Scenario: Alias resolves a cross-level import
- **WHEN** a file under `src/app` imports a module public API via `@/modules/<Name>`
- **THEN** the TypeScript project MUST resolve that import through the `@/*` path mapping to `src/*`

### Requirement: Domain modules Manifest and Lockfile
Manifest and Lockfile logic MUST live under `src/modules/Manifest` and `src/modules/Lockfile` respectively. Each MUST be a directory with an `index.ts` public entry. Deep imports into module internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. The presence of Resolver, Install, and Primitives MUST NOT remove or relocate Manifest or Lockfile module roots.

#### Scenario: App imports Manifest only via public entry
- **WHEN** app public API code needs Manifest behavior
- **THEN** it MUST import from `@/modules/Manifest` (the module `index.ts`) and MUST NOT import files under `modules/Manifest/` internals

#### Scenario: Lockfile does not deep-import Manifest
- **WHEN** Lockfile code needs shared YAML loading or related helpers that Manifest also uses
- **THEN** it MUST obtain them from `common` (concrete file paths) or from Manifest's public API only, and MUST NOT import Manifest internal paths such as former `manifest/yaml-load` internals

### Requirement: Shared YAML lives in common without barrel
Shared YAML safe-subset loading used by both Manifest and Lockfile MUST live under `src/common/` as concrete files. The `common` layer MUST NOT contain any `index.ts` / barrel file.

#### Scenario: Common YAML imported by concrete path
- **WHEN** Manifest or Lockfile needs the shared YAML loader
- **THEN** the import path MUST target a concrete file under `src/common/` (for example `@/common/yaml/loadYamlDocument`) and MUST NOT use a `common` barrel

### Requirement: Thin package entry preserves named exports
The package root `src/index.ts` MUST be a thin façade that re-exports the public surface from `app` (public API assembly). After migration, `@bapm/core` MUST continue to expose every previously exported named symbol (values and types) with the same export names. New Resolver, Install, Primitives, M6 lifecycle/integrity, M7 producer (init scaffold / pack / release-check), and M8 Policy public symbols MUST be re-exported from the package entry without breaking existing export names.

#### Scenario: Existing named exports remain available
- **WHEN** a consumer imports the set of symbols previously exported from `@bapm/core` (including Manifest/Lockfile/Resolver APIs, `loadYamlDocument`, `BAPM_NAME`, and `getVersion`)
- **THEN** each named export MUST still resolve from the package entry without requiring a new import path

#### Scenario: Unit and acceptance tests import from package entry
- **WHEN** existing `packages/core` unit tests and M1–M7 acceptance suites import from `../src/index.ts` or the package entry
- **THEN** those imports MUST continue to typecheck and run without changing the consumer-facing export names

#### Scenario: Resolver symbols exported from package entry
- **WHEN** a consumer imports Resolver public symbols such as `resolveAndLock` from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry

#### Scenario: Install and Primitives symbols exported from package entry
- **WHEN** a consumer imports Install or Primitives public symbols such as `runInstall` / `discoverPrimitives` (names flexible) from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry

#### Scenario: Lifecycle integrity symbols exported from package entry
- **WHEN** a consumer imports M6 lifecycle/integrity public symbols (update/outdated/uninstall/prune/deps/audit/doctor APIs, names flexible) from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry

#### Scenario: Producer symbols exported from package entry
- **WHEN** a consumer imports M7 producer public symbols (init scaffold / pack archive / check-release APIs, names flexible) from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry

#### Scenario: Policy symbols exported from package entry
- **WHEN** a consumer imports M8 Policy public symbols (parse/discover/evaluate/gate APIs, names flexible) from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry

### Requirement: Domain module Resolver
Resolver logic for classify, graph resolve, download orchestration, and `resolveAndLock` MUST live under `src/modules/Resolver` as a directory with an `index.ts` public entry. Deep imports into Resolver internals from outside that module MUST NOT be used. Resolver MUST consume Manifest and Lockfile only through their public module APIs (or `common` concrete paths), and MUST NOT deep-import Manifest or Lockfile internals. Single-file modules MUST NOT be used.

#### Scenario: App imports Resolver only via public entry
- **WHEN** app public API code needs resolve or `resolveAndLock` behavior
- **THEN** it MUST import from `@/modules/Resolver` and MUST NOT import files under `modules/Resolver/` internals

#### Scenario: Resolver does not deep-import Lockfile
- **WHEN** Resolver needs to write or load a lockfile
- **THEN** it MUST import from `@/modules/Lockfile` (or Manifest public API / `common`) and MUST NOT import Lockfile internal paths

### Requirement: Domain module Install
Install orchestration (frozen gate, reuse of resolve/download, invoke registered targets via `bapm-target-api`, lock write when not frozen, deployed-path inventory / `deployed_file_hashes` write-back, orphan cleanup of previously recorded harness files, and frozen hash re-verify when inventory exists) MUST live under `src/modules/Install` as a directory with an `index.ts` public entry. Deep imports into Install internals from outside that module MUST NOT be used. Install MUST consume Manifest, Lockfile, Resolver, and Primitives only through their public module APIs (or `common` concrete paths), and MUST NOT deep-import those modules' internals. Install MUST depend on `bapm-target-api` contracts for target interaction and MUST NOT import `bapm-target-cursor` or other concrete target packages. Single-file modules MUST NOT be used. Cleanup and hash helpers MUST remain inside the Install module tree (or `common` concrete utilities), not as new one-file domain modules.

#### Scenario: App imports Install only via public entry
- **WHEN** app public API code needs install or frozen-gate behavior
- **THEN** it MUST import from `@/modules/Install` and MUST NOT import files under `modules/Install/` internals

#### Scenario: Install does not import concrete cursor package
- **WHEN** Install needs to invoke host materialization
- **THEN** it MUST use `bapm-target-api` registration/contracts only and MUST NOT import `bapm-target-cursor`

#### Scenario: Inventory and cleanup stay in Install
- **WHEN** install records deployed hashes or removes orphan harness files
- **THEN** that logic MUST live under `modules/Install` (or `common` concrete helpers) and MUST NOT introduce a single-file module or a core hard dependency on a concrete `bapm-target-*`

### Requirement: Domain module Primitives
Primitives discovery, attribution, and conflict resolution MUST live under `src/modules/Primitives` as a directory with an `index.ts` public entry. Deep imports into Primitives internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used.

#### Scenario: App imports Primitives only via public entry
- **WHEN** app public API code needs discover or conflict-resolve behavior
- **THEN** it MUST import from `@/modules/Primitives` and MUST NOT import files under `modules/Primitives/` internals

### Requirement: Domain modules for lifecycle and integrity
Lifecycle and integrity domain logic for update, outdated, uninstall, prune, deps inspect, audit CI verify, and doctor basics MUST live under `packages/core/src/modules/` as directory modules with `index.ts` public entries (module names flexible, e.g. `Update`, `Outdated`, `Uninstall`, `Prune`, `Deps`, `Audit`, `Doctor`, or a small set of coalesced modules). Deep imports into those modules' internals from outside MUST NOT be used. Single-file modules MUST NOT be used. These modules MUST consume Manifest, Lockfile, Resolver, Install, and Primitives only through public APIs (or `common` concrete paths). They MUST NOT import `bapm-target-cursor` or other concrete target packages. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports lifecycle API only via public entry
- **WHEN** app public API code needs update, audit, or uninstall behavior
- **THEN** it MUST import from the corresponding `@/modules/<Name>` entry and MUST NOT deep-import module internals

#### Scenario: Lifecycle modules do not hard-depend on cursor
- **WHEN** uninstall/prune/audit need deployed inventory or cleanup
- **THEN** they MUST reuse Install/Lockfile public helpers or `bapm-target-api` contracts and MUST NOT import `bapm-target-cursor`

### Requirement: Domain modules for producer pack and release check
Producer pack/archive, secret-path refusal, archive extract helpers, and release-tag check logic MUST live under `packages/core/src/modules/` as directory module(s) with `index.ts` public entries (names flexible, e.g. `Pack`, or Pack + small helpers colocated). Init scaffold helpers MAY live on Manifest public API and/or a dedicated Init directory module — not as single-file modules. Deep imports into those modules' internals from outside MUST NOT be used. These modules MUST consume Manifest and Lockfile only through public APIs (or `common` concrete paths). They MUST NOT import `bapm-target-cursor` or other concrete target packages. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports Pack API only via public entry
- **WHEN** app public API code needs pack, extract, or check-release behavior
- **THEN** it MUST import from the corresponding `@/modules/<Name>` entry and MUST NOT deep-import module internals

#### Scenario: Producer modules do not hard-depend on cursor
- **WHEN** pack or init needs target tokens or layout
- **THEN** they MUST NOT import `bapm-target-cursor` and MUST NOT require a new `bapm-target-*` package

### Requirement: Domain module Policy
Policy parse, dual-file discovery, rule evaluation, and install-gate helpers MUST live under `packages/core/src/modules/Policy` as a directory with an `index.ts` public entry. Deep imports into Policy internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. Policy MUST consume shared YAML via `common` concrete paths (and MAY consume Manifest/Resolver/Lockfile only through their public APIs when evaluating candidates). Policy MUST NOT import `bapm-target-cursor` or other concrete target packages. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports Policy only via public entry
- **WHEN** app public API code needs parse, discover, evaluate, or gate behavior
- **THEN** it MUST import from `@/modules/Policy` and MUST NOT deep-import `modules/Policy/` internals

#### Scenario: Policy does not hard-depend on cursor
- **WHEN** Policy evaluates an install plan
- **THEN** it MUST NOT import `bapm-target-cursor` and MUST NOT require a new `bapm-target-*` package
