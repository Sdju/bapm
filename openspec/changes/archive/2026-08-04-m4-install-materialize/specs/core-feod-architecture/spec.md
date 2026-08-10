## ADDED Requirements

### Requirement: Domain module Install

Install orchestration (frozen gate, reuse of resolve/download, invoke registered targets via `bapm-target-api`, lock write when not frozen) MUST live under `src/modules/Install` as a directory with an `index.ts` public entry. Deep imports into Install internals from outside that module MUST NOT be used. Install MUST consume Manifest, Lockfile, Resolver, and Primitives only through their public module APIs (or `common` concrete paths), and MUST NOT deep-import those modules' internals. Install MUST depend on `bapm-target-api` contracts for target interaction and MUST NOT import `bapm-target-cursor` or other concrete target packages. Single-file modules MUST NOT be used.

#### Scenario: App imports Install only via public entry

- **WHEN** app public API code needs install or frozen-gate behavior
- **THEN** it MUST import from `@/modules/Install` and MUST NOT import files under `modules/Install/` internals

#### Scenario: Install does not import concrete cursor package

- **WHEN** Install needs to invoke host materialization
- **THEN** it MUST use `bapm-target-api` registration/contracts only and MUST NOT import `bapm-target-cursor`

### Requirement: Domain module Primitives

Primitives discovery, attribution, and conflict resolution MUST live under `src/modules/Primitives` as a directory with an `index.ts` public entry. Deep imports into Primitives internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used.

#### Scenario: App imports Primitives only via public entry

- **WHEN** app public API code needs discover or conflict-resolve behavior
- **THEN** it MUST import from `@/modules/Primitives` and MUST NOT import files under `modules/Primitives/` internals

## MODIFIED Requirements

### Requirement: Domain modules Manifest and Lockfile

Manifest and Lockfile logic MUST live under `src/modules/Manifest` and `src/modules/Lockfile` respectively. Each MUST be a directory with an `index.ts` public entry. Deep imports into module internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. The presence of Resolver, Install, and Primitives MUST NOT remove or relocate Manifest or Lockfile module roots.

#### Scenario: App imports Manifest only via public entry

- **WHEN** app public API code needs Manifest behavior
- **THEN** it MUST import from `@/modules/Manifest` (the module `index.ts`) and MUST NOT import files under `modules/Manifest/` internals

#### Scenario: Lockfile does not deep-import Manifest

- **WHEN** Lockfile code needs shared YAML loading or related helpers that Manifest also uses
- **THEN** it MUST obtain them from `common` (concrete file paths) or from Manifest's public API only, and MUST NOT import Manifest internal paths such as former `manifest/yaml-load` internals

### Requirement: Thin package entry preserves named exports

The package root `src/index.ts` MUST be a thin façade that re-exports the public surface from `app` (public API assembly). After migration, `@b-apm/core` MUST continue to expose every previously exported named symbol (values and types) with the same export names. New Resolver, Install, and Primitives public symbols MUST be re-exported from the package entry without breaking existing export names.

#### Scenario: Existing named exports remain available

- **WHEN** a consumer imports the set of symbols previously exported from `@b-apm/core` (including Manifest/Lockfile/Resolver APIs, `loadYamlDocument`, `BAPM_NAME`, and `getVersion`)
- **THEN** each named export MUST still resolve from the package entry without requiring a new import path

#### Scenario: Unit and acceptance tests import from package entry

- **WHEN** existing `packages/core` unit tests and M1/M2/M3 acceptance suites import from `../src/index.ts` or the package entry
- **THEN** those imports MUST continue to typecheck and run without changing the consumer-facing export names

#### Scenario: Resolver symbols exported from package entry

- **WHEN** a consumer imports Resolver public symbols such as `resolveAndLock` from `@b-apm/core`
- **THEN** those named exports MUST resolve from the package entry

#### Scenario: Install and Primitives symbols exported from package entry

- **WHEN** a consumer imports Install or Primitives public symbols such as `runInstall` / `discoverPrimitives` (names flexible) from `@b-apm/core`
- **THEN** those named exports MUST resolve from the package entry
