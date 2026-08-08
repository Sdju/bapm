## MODIFIED Requirements

### Requirement: Domain module Marketplace

Marketplace models, local `marketplaces.json` registry, fetch/cache client, path helpers, errors, thin validate helpers, and marketplace plugin parse/resolve helpers MUST live under `packages/core/src/modules/Marketplace` as a FEOD directory module with an `index.ts` public entry. Deep imports into `Marketplace` internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. `Marketplace` MUST NOT import or extend the package Registry HTTP client module for `marketplace.json` I/O. New public symbols MUST be re-exported from the package entry via `app/publicApi`. Resolver MUST resolve `kind: "marketplace"` via Marketplace public APIs (fail-closed-only-for-marketplace is removed in this change).

#### Scenario: App imports Marketplace only via public entry

- **WHEN** app public API code needs marketplace models, registry, fetch, or plugin-resolve behavior
- **THEN** it MUST import from `@/modules/Marketplace` (the module `index.ts`) and MUST NOT import files under `modules/Marketplace/` internals

#### Scenario: Marketplace does not reuse Registry HTTP client

- **WHEN** marketplace fetch, registry CRUD, or plugin resolve runs inside `@bapm/core`
- **THEN** those code paths MUST NOT import Registry HTTP client/createClient APIs for marketplace.json and MUST NOT require `BAPM_EXPERIMENTAL_REGISTRIES` for marketplace.json I/O

#### Scenario: Marketplace symbols exported from package entry

- **WHEN** a consumer imports Marketplace public symbols (names flexible) from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry

#### Scenario: Resolver uses Marketplace resolve for marketplace kind

- **WHEN** graph resolve encounters a marketplace-kind dependency
- **THEN** it MUST call Marketplace public resolve helpers rather than failing closed solely because the kind is marketplace
