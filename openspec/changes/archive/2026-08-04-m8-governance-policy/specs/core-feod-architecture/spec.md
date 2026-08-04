## ADDED Requirements

### Requirement: Domain module Policy
Policy parse, dual-file discovery, rule evaluation, and install-gate helpers MUST live under `packages/core/src/modules/Policy` as a directory with an `index.ts` public entry. Deep imports into Policy internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. Policy MUST consume shared YAML via `common` concrete paths (and MAY consume Manifest/Resolver/Lockfile only through their public APIs when evaluating candidates). Policy MUST NOT import `bapm-target-cursor` or other concrete target packages. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports Policy only via public entry
- **WHEN** app public API code needs parse, discover, evaluate, or gate behavior
- **THEN** it MUST import from `@/modules/Policy` and MUST NOT deep-import `modules/Policy/` internals

#### Scenario: Policy does not hard-depend on cursor
- **WHEN** Policy evaluates an install plan
- **THEN** it MUST NOT import `bapm-target-cursor` and MUST NOT require a new `bapm-target-*` package

## MODIFIED Requirements

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
