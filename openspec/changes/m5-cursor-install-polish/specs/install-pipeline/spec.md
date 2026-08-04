## ADDED Requirements

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

## MODIFIED Requirements

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
