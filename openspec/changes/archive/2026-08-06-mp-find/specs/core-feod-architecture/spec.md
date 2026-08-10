## ADDED Requirements

### Requirement: Domain module Find

Offline reverse-index helpers for deployed inventory lookup (`buildReverseIndex` / lookup / find orchestration and related formatters) MUST live under `packages/core/src/modules/Find` as a FEOD directory module with an `index.ts` public entry. Deep imports into `Find` internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used. New public symbols MUST be re-exported from the package entry via `app/publicApi`. The Find module MUST NOT import Marketplace and MUST NOT perform network I/O. Find MAY import Lockfile and Deps public APIs (for lock load and `whyDeps`).

#### Scenario: App imports Find only via public entry

- **WHEN** application or CLI code needs reverse-index / find helpers
- **THEN** it MUST import from `@/modules/Find` (the module `index.ts`) and MUST NOT import files under `modules/Find/` internals

#### Scenario: Find symbols exported from package entry

- **WHEN** a consumer imports Find public symbols (names flexible) from `@b-apm/core`
- **THEN** the import MUST resolve via the package public API surface

#### Scenario: Find does not depend on Marketplace

- **WHEN** the Find module graph is inspected
- **THEN** Find MUST NOT import Marketplace modules or marketplace registry/fetch clients
