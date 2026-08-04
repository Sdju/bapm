# install-pipeline Specification

## Purpose

Defines `@bapm/core` install orchestration after M3 resolve/download: modules placement, lock write-back unless frozen, target intersection and deploy only through registered `bapm-target-api` contracts, and basic OpenAPM frozen gate (lk-006).

## Requirements

### Requirement: Install places modules and writes lock when not frozen
Non-frozen install MUST ensure resolved packages are present under the modules directory (reuse M3 resolve/download path) and MUST write or update the lockfile per M2 dual-read/write-back rules. Fresh install with only a manifest MUST create modules and a lockfile.

#### Scenario: Warm install places modules
- **WHEN** install runs non-frozen with an existing lock and resolvable git/local deps
- **THEN** packages MUST be present under the modules directory and lock write-back MUST follow M2 dual-read rules

#### Scenario: Fresh install writes lock
- **WHEN** install runs non-frozen with a manifest and no lockfile
- **THEN** modules MUST be created and a lockfile MUST be written

### Requirement: Basic frozen gate before mutation
When frozen mode is active, install MUST fail closed before modules, lock, or target harness writes if the lockfile is absent or a direct dependency pin is missing. On a successful frozen path, the lockfile bytes MUST remain unchanged (ignore atime). Combining frozen with an update/re-resolve flag MUST be rejected. MCP freeze checks MAY stub if MCP install is out of scope. When `deployed_file_hashes` are present in the lock, frozen install MUST also re-verify those hashes (lk-017 lite) as specified by the deployed-hash requirement. Default-frozen-on-CI (lk-018) remains optional for M5.

#### Scenario: Frozen missing lock fails before writes
- **WHEN** install runs with frozen mode and no lockfile
- **THEN** it MUST fail before any modules, lock, or target harness writes

#### Scenario: Frozen missing direct pin fails closed
- **WHEN** install runs with frozen mode and the lock lacks a required direct dependency pin
- **THEN** it MUST fail closed without rewriting the lock

#### Scenario: Frozen success leaves lock bytes unchanged
- **WHEN** install runs with frozen mode against a valid lock and succeeds or no-ops
- **THEN** the lockfile content bytes MUST be identical to before the run

#### Scenario: Frozen rejects update-refs
- **WHEN** install is invoked with frozen mode combined with an update/re-resolve flag
- **THEN** the invocation MUST be rejected without mutation

### Requirement: Write deployed file hashes after materialize
When install materializes harness files through a registered target and is not in a path that forbids lock mutation, install MUST record `deployed_file_hashes` (per dependency and/or document-level fields already modeled by the lockfile schema) for the paths reported by materialize. Hash algorithm MUST be documented and stable enough for byte re-verify on a subsequent frozen install.

#### Scenario: Lock gains hashes after deploy
- **WHEN** a non-frozen install deploys cursor skills/rules/agents and writes lock write-back
- **THEN** the lockfile MUST include `deployed_file_hashes` entries covering the deployed harness paths for the relevant dependency inventory

### Requirement: Orphan cleanup for removed dependency deploy inventory
When the previous lock lists deployed harness paths (via `deployed_file_hashes` or equivalent inventory) for a dependency that is no longer in the resolved install set, install MUST remove those orphaned files (or fail closed with a documented reason if removal is unsafe). Cleanup MUST NOT delete files outside previously recorded inventory paths.

#### Scenario: Removed dep cleans recorded harness files
- **WHEN** lock inventory lists deployed files for dependency X and the next install no longer includes X
- **THEN** those recorded files MUST be removed (or the run MUST fail closed with a documented reason) and unrelated project files MUST remain untouched

### Requirement: Frozen re-verifies deployed file hashes when present
When frozen mode is active and the lock contains `deployed_file_hashes` for deployed harness files, install MUST re-verify on-disk content against those hashes (lk-017 lite) and MUST fail closed if a recorded file is missing or its content hash mismatches. If the lock has no deployed hash inventory, install MUST NOT invent a pass for tampered harness files beyond existing lk-006 pin checks.

#### Scenario: Tampered deployed file fails frozen
- **WHEN** install runs with `--frozen`, the lock has `deployed_file_hashes`, and a recorded harness file on disk has been altered
- **THEN** install MUST fail before treating the run as successful and MUST NOT rewrite the lockfile

### Requirement: Forced target activation without detect signal
Install MUST accept an explicit forced target id (for example from CLI `--target cursor`) when that id is registered. When forced, install MUST invoke that target's materialize even if `detect` would be false, allowing creation of registered roots. Unknown forced target ids MUST be rejected with a clear error. Without a forced target and without a positive detect, install MUST still complete modules and lock work and MUST NOT write harness files (MAY warn).

#### Scenario: Force cursor without detect
- **WHEN** install is invoked with forced target `cursor`, cursor is registered, and `.cursor/` is absent
- **THEN** materialize for cursor MUST run and MAY create registered deploy roots

#### Scenario: Unknown forced target rejected
- **WHEN** install is invoked with forced target id that is not registered
- **THEN** install MUST fail with a clear error and MUST NOT write harness files for that id

### Requirement: Deploy only via registered target-api contracts
Core install MUST invoke host materialization only through `bapm-target-api` registration/contracts. Core MUST NOT hard-depend on `bapm-target-cursor` or any concrete `bapm-target-*` package. With no target registered or none detected, install MUST still complete modules and lock work and MUST NOT write harness files (MAY warn).

#### Scenario: No hard dependency on concrete target
- **WHEN** inspecting `@bapm/core` package dependencies
- **THEN** it MUST list `bapm-target-api` (or workspace equivalent) and MUST NOT list `bapm-target-cursor` or other concrete `bapm-target-*` packages

#### Scenario: Integrate without registered target
- **WHEN** install runs with no target registered and none detected
- **THEN** modules and lock MUST succeed and no harness deploy files MUST be written by core

#### Scenario: Materialize uses conflict-resolved set
- **WHEN** install integrates with an active registered target and discovered primitives
- **THEN** the target `materialize` contract MUST be invoked with the conflict-resolved primitive set, not raw duplicates

#### Scenario: Core does not write harness paths itself
- **WHEN** install runs with a mock/spy target registered via the API
- **THEN** only the registered target implementation MUST perform writes under its declared deploy roots

### Requirement: target and targets mutual exclusion and intersection
Manifest parsing/install MUST hard-error when both `target` and `targets` fields are present (OpenAPM tg-008). When integrating, primitives from a package MUST be deployed only into the intersection of active project targets, consumer-authorized targets, and package-declared targets. Vendor-style ids matching `x-<vendor>-<name>` MUST be accepted as target identifiers (tg-004); deploy MUST occur only if a package is registered for that id.

#### Scenario: Mutual exclusion of target fields
- **WHEN** a manifest contains both `target` and `targets`
- **THEN** parse or install MUST fail with a hard error

#### Scenario: Intersection skips non-overlapping package targets
- **WHEN** the project active target is `cursor` and a dependency declares `targets: [copilot]`
- **THEN** that dependency's primitives MUST NOT be deployed to the cursor target

#### Scenario: Vendor target id accepted
- **WHEN** a manifest uses `target: x-acme-editor`
- **THEN** validation MUST accept the id as a vendor target id; deploy MUST happen only if that id is registered

### Requirement: Deploy only under registered deploy roots
When a concrete target is active, all harness writes performed through that target MUST stay under the deploy root(s) registered for it (tg-002).

#### Scenario: Writes stay under registered roots
- **WHEN** an active target materializes primitives during install
- **THEN** every written harness path MUST be under that target's registered deploy root(s)
