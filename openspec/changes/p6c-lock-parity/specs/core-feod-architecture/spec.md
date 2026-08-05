## ADDED Requirements

### Requirement: Domain module Export
SBOM inventory export logic MUST live under `src/modules/Export` as a FEOD directory module with an `index.ts` public entry. Deep imports into `Export` internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. `Export` MAY depend on `Lockfile` only through `@/modules/Lockfile` public API (types/load helpers as needed) and MUST NOT absorb Lockfile YAML parse/serialize responsibilities. SPDX/CycloneDX tables and purl helpers that are heavy MAY live behind lazy import boundaries inside `Export` so they stay off the default critical path of unrelated core imports when practical.

#### Scenario: App imports Export only via public entry
- **WHEN** app public API code needs SBOM export behavior
- **THEN** it MUST import from `@/modules/Export` (the module `index.ts`) and MUST NOT import files under `modules/Export/` internals

#### Scenario: Export does not deep-import Lockfile internals
- **WHEN** Export needs lock document types or load helpers
- **THEN** it MUST import from `@/modules/Lockfile` public API only

### Requirement: Export symbols re-exported from package entry
`@bapm/core` package public API assembly MUST re-export Export public symbols (values and types) used by CLI and tests so consumers import them from the package entry without deep paths.

#### Scenario: Consumer imports exportSbom from package entry
- **WHEN** a consumer imports the primary SBOM export function (name flexible, e.g. `exportSbom`) from `@bapm/core`
- **THEN** that named export MUST resolve from the package entry
