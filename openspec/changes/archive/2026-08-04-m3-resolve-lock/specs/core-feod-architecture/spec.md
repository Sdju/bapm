## ADDED Requirements

### Requirement: Domain module Resolver

Resolver logic for classify, graph resolve, download orchestration, and `resolveAndLock` MUST live under `src/modules/Resolver` as a directory with an `index.ts` public entry. Deep imports into Resolver internals from outside that module MUST NOT be used. Resolver MUST consume Manifest and Lockfile only through their public module APIs (or `common` concrete paths), and MUST NOT deep-import Manifest or Lockfile internals. Single-file modules MUST NOT be used.

#### Scenario: App imports Resolver only via public entry

- **WHEN** app public API code needs resolve or `resolveAndLock` behavior
- **THEN** it MUST import from `@/modules/Resolver` and MUST NOT import files under `modules/Resolver/` internals

#### Scenario: Resolver does not deep-import Lockfile

- **WHEN** Resolver needs to write or load a lockfile
- **THEN** it MUST import from `@/modules/Lockfile` (or Manifest public API / `common`) and MUST NOT import Lockfile internal paths

## MODIFIED Requirements

### Requirement: Domain modules Manifest and Lockfile

Manifest and Lockfile logic MUST live under `src/modules/Manifest` and `src/modules/Lockfile` respectively. Each MUST be a directory with an `index.ts` public entry. Deep imports into module internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. The presence of Resolver MUST NOT remove or relocate Manifest or Lockfile module roots.

#### Scenario: App imports Manifest only via public entry

- **WHEN** app public API code needs Manifest behavior
- **THEN** it MUST import from `@/modules/Manifest` (the module `index.ts`) and MUST NOT import files under `modules/Manifest/` internals

#### Scenario: Lockfile does not deep-import Manifest

- **WHEN** Lockfile code needs shared YAML loading or related helpers that Manifest also uses
- **THEN** it MUST obtain them from `common` (concrete file paths) or from Manifest's public API only, and MUST NOT import Manifest internal paths such as former `manifest/yaml-load` internals

### Requirement: Thin package entry preserves named exports

The package root `src/index.ts` MUST be a thin façade that re-exports the public surface from `app` (public API assembly). After migration, `@bapm/core` MUST continue to expose every previously exported named symbol (values and types) with the same export names. New Resolver public symbols MUST be re-exported from the package entry without breaking existing export names.

#### Scenario: Existing named exports remain available

- **WHEN** a consumer imports the set of symbols previously exported from `@bapm/core` (including Manifest/Lockfile APIs, `loadYamlDocument`, `BAPM_NAME`, and `getVersion`)
- **THEN** each named export MUST still resolve from the package entry without requiring a new import path

#### Scenario: Unit and acceptance tests import from package entry

- **WHEN** existing `packages/core` unit tests and M1/M2 acceptance suites import from `../src/index.ts` or the package entry
- **THEN** those imports MUST continue to typecheck and run without changing the consumer-facing export names

#### Scenario: Resolver symbols exported from package entry

- **WHEN** a consumer imports Resolver public symbols such as `resolveAndLock` from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry
