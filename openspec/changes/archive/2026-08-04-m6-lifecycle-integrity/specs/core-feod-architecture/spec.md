## ADDED Requirements

### Requirement: Domain modules for lifecycle and integrity

Lifecycle and integrity domain logic for update, outdated, uninstall, prune, deps inspect, audit CI verify, and doctor basics MUST live under `packages/core/src/modules/` as directory modules with `index.ts` public entries (module names flexible, e.g. `Update`, `Outdated`, `Uninstall`, `Prune`, `Deps`, `Audit`, `Doctor`, or a small set of coalesced modules). Deep imports into those modules' internals from outside MUST NOT be used. Single-file modules MUST NOT be used. These modules MUST consume Manifest, Lockfile, Resolver, Install, and Primitives only through public APIs (or `common` concrete paths). They MUST NOT import `bapm-target-cursor` or other concrete target packages. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports lifecycle API only via public entry

- **WHEN** app public API code needs update, audit, or uninstall behavior
- **THEN** it MUST import from the corresponding `@/modules/<Name>` entry and MUST NOT deep-import module internals

#### Scenario: Lifecycle modules do not hard-depend on cursor

- **WHEN** uninstall/prune/audit need deployed inventory or cleanup
- **THEN** they MUST reuse Install/Lockfile public helpers or `bapm-target-api` contracts and MUST NOT import `bapm-target-cursor`

## MODIFIED Requirements

### Requirement: Thin package entry preserves named exports

The package root `src/index.ts` MUST be a thin façade that re-exports the public surface from `app` (public API assembly). After migration, `@bapm/core` MUST continue to expose every previously exported named symbol (values and types) with the same export names. New Resolver, Install, Primitives, and M6 lifecycle/integrity public symbols MUST be re-exported from the package entry without breaking existing export names.

#### Scenario: Existing named exports remain available

- **WHEN** a consumer imports the set of symbols previously exported from `@bapm/core` (including Manifest/Lockfile/Resolver APIs, `loadYamlDocument`, `BAPM_NAME`, and `getVersion`)
- **THEN** each named export MUST still resolve from the package entry without requiring a new import path

#### Scenario: Unit and acceptance tests import from package entry

- **WHEN** existing `packages/core` unit tests and M1–M5 acceptance suites import from `../src/index.ts` or the package entry
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
