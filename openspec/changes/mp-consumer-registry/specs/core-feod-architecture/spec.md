## ADDED Requirements

### Requirement: Domain module Marketplace
Marketplace models, local `marketplaces.json` registry, fetch/cache client, path helpers, errors, and thin validate helpers MUST live under `packages/core/src/modules/Marketplace` as a FEOD directory module with an `index.ts` public entry. Deep imports into `Marketplace` internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. `Marketplace` MUST NOT import or extend the package Registry HTTP client module for `marketplace.json` I/O. New public symbols MUST be re-exported from the package entry via `app/publicApi`. Resolver marketplace fail-closed dependency behavior MUST remain unchanged in this change.

#### Scenario: App imports Marketplace only via public entry
- **WHEN** app public API code needs marketplace models, registry, or fetch behavior
- **THEN** it MUST import from `@/modules/Marketplace` (the module `index.ts`) and MUST NOT import files under `modules/Marketplace/` internals

#### Scenario: Marketplace does not reuse Registry HTTP client
- **WHEN** marketplace fetch or registry CRUD runs inside `@bapm/core`
- **THEN** those code paths MUST NOT import Registry HTTP client/createClient APIs for marketplace.json and MUST NOT require `BAPM_EXPERIMENTAL_REGISTRIES`

#### Scenario: Marketplace symbols exported from package entry
- **WHEN** a consumer imports Marketplace public symbols (names flexible) from `@bapm/core`
- **THEN** those named exports MUST resolve from the package entry
