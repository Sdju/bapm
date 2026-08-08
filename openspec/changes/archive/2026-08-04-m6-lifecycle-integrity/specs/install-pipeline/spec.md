## ADDED Requirements

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
