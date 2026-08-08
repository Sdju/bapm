## MODIFIED Requirements

### Requirement: Thin package entry preserves named exports

The package root `src/index.ts` MUST be a thin façade that re-exports the public surface from `app` (public API assembly). After migration, `@bapm/core` MUST continue to expose every previously exported named symbol (values and types) with the same export names. New Resolver, Install, Primitives, M6 lifecycle/integrity, M7 producer (init scaffold / pack / release-check), M8 Policy, M9 MCP/trust/compile/cache, and M10 Registry/publish/self-update-check public symbols MUST be re-exported from the package entry without breaking existing export names.

#### Scenario: Existing named exports remain available

- **WHEN** a consumer imports the set of symbols previously exported from `@bapm/core` (including Manifest/Lockfile/Resolver APIs, `loadYamlDocument`, `BAPM_NAME`, and `getVersion`)
- **THEN** each named export MUST still resolve from the package entry without requiring a new import path

#### Scenario: Unit and acceptance tests import from package entry

- **WHEN** existing `packages/core` unit tests and M1–M9 acceptance suites import from `../src/index.ts` or the package entry
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

#### Scenario: Registry and publish symbols exported from package entry

- **WHEN** a consumer imports M10 Registry client / registry resolve / publish / self-update-check public symbols (names flexible) from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry

## ADDED Requirements

### Requirement: Domain module Registry

Registry HTTP client, registry resolve helpers (list/pick/download/verify), flat publish-archive builder, and self-update check metadata helpers MUST live under `packages/core/src/modules/` as directory module(s) with `index.ts` public entries (names flexible, e.g. `Registry`, or Registry + `Publish` / `SelfUpdate` split). Deep imports into those modules' internals from outside MUST NOT be used. Single-file modules MUST NOT be used. These modules MUST consume Manifest, Lockfile, and Resolver only through public APIs (or `common` concrete paths). They MUST NOT import `bapm-target-cursor` or other concrete target packages. HTTP transport MUST be injectable for tests. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports Registry only via public entry

- **WHEN** app public API code needs registry client, registry resolve, or publish-archive behavior
- **THEN** it MUST import from the corresponding `@/modules/<Name>` entry and MUST NOT deep-import module internals

#### Scenario: Registry modules do not hard-depend on cursor

- **WHEN** registry resolve or publish runs inside `@bapm/core`
- **THEN** those modules MUST NOT import `bapm-target-cursor` and MUST NOT require a new `bapm-target-*` package
