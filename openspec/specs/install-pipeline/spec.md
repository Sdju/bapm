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

### Requirement: Deployed hash verify is reusable for audit CI
The deployed-file hash re-verify logic used by frozen install (lk-017 lite) MUST be reusable as a library/public helper so `audit --ci` can perform the same SHA-256 presence + hash checks without requiring a full frozen install mutation path. Audit MUST fail closed on missing recorded files or hash mismatch identically in spirit to frozen re-verify.

#### Scenario: Audit reuses hash verify semantics
- **WHEN** `audit --ci` runs against a lock with `deployed_file_hashes`
- **THEN** verification MUST apply the same hash algorithm and fail-closed rules as frozen install hash re-verify for those inventory entries

### Requirement: Uninstall and prune compose install cleanup helpers
Uninstall of removed deps and prune of orphan modules MUST reuse existing orphan/deployed-inventory cleanup patterns from Install where applicable (delete only recorded harness paths; do not wipe unregistered user files). Update after successful apply MAY compose non-frozen install/materialize so modules and deploy stay consistent with the new lock.

#### Scenario: Uninstall cleans recorded deploy inventory
- **WHEN** uninstall removes dep X that has `deployed_file_hashes` inventory
- **THEN** those recorded harness paths MUST be removed using inventory-scoped cleanup (not a full harness wipe)

### Requirement: Install accepts a local pack archive path
Install MUST accept a local filesystem path to a pack-produced plain zip as an install source. When the argument is such an archive, install MUST extract/consume the conforming layout (manifest at expected root; optional packed lock/primitives) into the target project directory and MUST make the resulting manifest dual-read parseable. On invalid archive layout or failing manifest validate, install MUST fail closed with non-zero exit. This path is the primary M7 round-trip for pack (unpack-equivalent). Full network resolve of archive-embedded deps MAY proceed via existing install orchestration after extract when dependencies are present.

#### Scenario: Install from pack zip lands manifest
- **WHEN** install is invoked with a path to a valid pack-produced zip containing `bapm.yml` (or `apm.yml`) at the expected root
- **THEN** the project output MUST contain a dual-read parseable manifest and the command MUST NOT treat the zip as an unknown package ref without attempting archive consume

#### Scenario: Corrupt archive fails closed
- **WHEN** install is invoked with a path that is not a valid pack zip layout
- **THEN** install MUST exit non-zero without claiming a successful archive install

### Requirement: Policy gate before download and materialize
Install orchestration MUST invoke policy discovery and evaluation against the resolved install plan before downloading packages into the modules directory and before target materialize/deploy for the proposed install. When the gate reports blocking violations, install MUST fail closed without those durable writes. When policy is absent or the caller opts out via no-policy/env disable, install MUST behave as before M8 (ungated). Preferred pipeline shape is resolve-plan → policy-gate → download → primitives/targets (OpenAPM pl-002 strict).

#### Scenario: Blocking policy stops before modules write
- **WHEN** install has a resolved plan that violates a blocking policy
- **THEN** install MUST NOT download/write new modules content for that plan and MUST NOT deploy target harness files for that plan

#### Scenario: Ungated path unchanged without policy
- **WHEN** install runs with no discovered policy and no explicit policy path
- **THEN** resolve/download/materialize MUST proceed under existing M3–M7 rules

### Requirement: Install options accept policy controls
Install public options MUST accept an explicit policy path/ref, a no-policy/disable flag, and MUST honor environment disable when wired by the CLI. Dual-conflict of local policy filenames MUST surface as install failure before durable writes.

#### Scenario: Explicit policy path on install
- **WHEN** install is invoked with an explicit policy path to a valid deny/block document matching a planned dep
- **THEN** that policy MUST be used for the gate even if sibling brand files exist

### Requirement: MCP deploy and trust after policy gate
After the M8 policy gate (when applicable) and before or as part of durable target harness writes, install MUST run executable MCP trust (sc-009) and Cursor MCP deploy for eligible servers when the cursor target is active. Blocking trust withhold MUST prevent writing the withheld MCP entries. Policy block MUST still stop modules/deploy before MCP writes. Projects without MCP MUST keep existing modules+skills paths unchanged.

#### Scenario: Policy block precedes MCP write
- **WHEN** install has a blocking policy violation on the plan
- **THEN** install MUST NOT write `.cursor/mcp.json` for that plan

#### Scenario: Trust withhold skips MCP entry
- **WHEN** policy allows the plan but sc-009 withholds a dependency's MCP
- **THEN** that MCP entry MUST NOT appear in `.cursor/mcp.json`

#### Scenario: Eligible MCP deploys with cursor active
- **WHEN** policy allows, trust approves (or no grant surface), cursor is active, and direct MCP exists
- **THEN** `.cursor/mcp.json` MUST be updated and lock `mcp_*` fields MUST reflect configured servers

### Requirement: Install accepts transitive MCP trust flag
Install options MUST accept an explicit trust-transitive-MCP flag (name MAY mirror APM `--trust-transitive-mcp`). Default MUST keep transitive MCP undeployed.

#### Scenario: Trust transitive flag enables transitive MCP
- **WHEN** install is invoked with the trust-transitive-MCP flag and a transitive MCP server is present with cursor active and trust allows
- **THEN** that transitive MCP MAY be deployed per documented rules

### Requirement: Install materializes registry packages after policy gate
When the resolved set includes registry-sourced packages, install MUST materialize verified registry archives into the modules directory using the registry-resolve-install path (lk-013 before extract). The M8 policy gate MUST still run before durable modules/lock/deploy writes. Git/local-only installs MUST remain unchanged.

#### Scenario: Registry install places modules with verified hash
- **WHEN** non-frozen install runs with a registry dep against a mock registry that serves matching digest bytes
- **THEN** the package MUST be present under modules and the lock MUST record `resolved_hash` matching those bytes

#### Scenario: Policy still blocks registry dep before writes
- **WHEN** install proposes a registry dep denied by policy in block mode
- **THEN** install MUST fail closed before modules/lock durable writes for that plan

#### Scenario: Digest mismatch leaves modules unchanged
- **WHEN** registry download bytes do not match advertised digest during install
- **THEN** install MUST fail closed and MUST NOT leave a successful partial extract for that package
