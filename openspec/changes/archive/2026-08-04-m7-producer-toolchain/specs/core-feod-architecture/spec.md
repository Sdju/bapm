## ADDED Requirements

### Requirement: Domain modules for producer pack and release check
Producer pack/archive, secret-path refusal, archive extract helpers, and release-tag check logic MUST live under `packages/core/src/modules/` as directory module(s) with `index.ts` public entries (names flexible, e.g. `Pack`, or Pack + small helpers colocated). Init scaffold helpers MAY live on Manifest public API and/or a dedicated Init directory module — not as single-file modules. Deep imports into those modules' internals from outside MUST NOT be used. These modules MUST consume Manifest and Lockfile only through public APIs (or `common` concrete paths). They MUST NOT import `bapm-target-cursor` or other concrete target packages. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports Pack API only via public entry
- **WHEN** app public API code needs pack, extract, or check-release behavior
- **THEN** it MUST import from the corresponding `@/modules/<Name>` entry and MUST NOT deep-import module internals

#### Scenario: Producer modules do not hard-depend on cursor
- **WHEN** pack or init needs target tokens or layout
- **THEN** they MUST NOT import `bapm-target-cursor` and MUST NOT require a new `bapm-target-*` package

## MODIFIED Requirements

### Requirement: Thin package entry preserves named exports
The package root `src/index.ts` MUST be a thin façade that re-exports the public surface from `app` (public API assembly). After migration, `@bapm/core` MUST continue to expose every previously exported named symbol (values and types) with the same export names. New Resolver, Install, Primitives, M6 lifecycle/integrity, and M7 producer (init scaffold / pack / release-check) public symbols MUST be re-exported from the package entry without breaking existing export names.

#### Scenario: Existing named exports remain available
- **WHEN** a consumer imports the set of symbols previously exported from `@bapm/core` (including Manifest/Lockfile/Resolver APIs, `loadYamlDocument`, `BAPM_NAME`, and `getVersion`)
- **THEN** each named export MUST still resolve from the package entry without requiring a new import path

#### Scenario: Unit and acceptance tests import from package entry
- **WHEN** existing `packages/core` unit tests and M1–M6 acceptance suites import from `../src/index.ts` or the package entry
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
