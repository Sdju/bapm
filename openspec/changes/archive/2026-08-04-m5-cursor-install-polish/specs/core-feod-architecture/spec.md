## MODIFIED Requirements

### Requirement: Domain module Install

Install orchestration (frozen gate, reuse of resolve/download, invoke registered targets via `bapm-target-api`, lock write when not frozen, deployed-path inventory / `deployed_file_hashes` write-back, orphan cleanup of previously recorded harness files, and frozen hash re-verify when inventory exists) MUST live under `src/modules/Install` as a directory with an `index.ts` public entry. Deep imports into Install internals from outside that module MUST NOT be used. Install MUST consume Manifest, Lockfile, Resolver, and Primitives only through their public module APIs (or `common` concrete paths), and MUST NOT deep-import those modules' internals. Install MUST depend on `bapm-target-api` contracts for target interaction and MUST NOT import `bapm-target-cursor` or other concrete target packages. Single-file modules MUST NOT be used. Cleanup and hash helpers MUST remain inside the Install module tree (or `common` concrete utilities), not as new one-file domain modules.

#### Scenario: App imports Install only via public entry

- **WHEN** app public API code needs install or frozen-gate behavior
- **THEN** it MUST import from `@/modules/Install` and MUST NOT import files under `modules/Install/` internals

#### Scenario: Install does not import concrete cursor package

- **WHEN** Install needs to invoke host materialization
- **THEN** it MUST use `bapm-target-api` registration/contracts only and MUST NOT import `bapm-target-cursor`

#### Scenario: Inventory and cleanup stay in Install

- **WHEN** install records deployed hashes or removes orphan harness files
- **THEN** that logic MUST live under `modules/Install` (or `common` concrete helpers) and MUST NOT introduce a single-file module or a core hard dependency on a concrete `bapm-target-*`
