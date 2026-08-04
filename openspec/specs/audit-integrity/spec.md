# audit-integrity Specification

## Purpose

Defines `bapm audit --ci` as the Consumer integrity CI gate: lock presence/consistency, deployed file presence, and SHA-256 re-verify of `deployed_file_hashes` (OpenAPM lk-017 / sc-001 subset) with exit 0 clean / 1 violations.

## Requirements

### Requirement: audit --ci verifies lock presence
When `audit --ci` runs, the system MUST require a discoverable lockfile via dual-read rules. Missing lock MUST yield exit code `1` (or other non-zero) suitable for CI.

#### Scenario: Missing lock fails CI audit
- **WHEN** `audit --ci` runs in a project without a lockfile
- **THEN** the exit code MUST be non-zero

### Requirement: audit --ci re-verifies deployed file hashes
When `deployed_file_hashes` (or equivalent lock inventory) are present, `audit --ci` MUST re-verify on-disk file bytes against recorded SHA-256 hashes (OpenAPM lk-017 / sc-001). Mismatch MUST exit `1` with a diagnostic naming the path and expected/observed envelopes. Missing recorded deployed file on disk MUST exit `1`.

#### Scenario: Clean inventory exits zero
- **WHEN** lock is consistent, recorded deployed files exist, and hashes match on disk, and `audit --ci` runs
- **THEN** the exit code MUST be `0`

#### Scenario: Tampered file fails CI audit
- **WHEN** a recorded deployed file's content differs from `deployed_file_hashes` and `audit --ci` runs
- **THEN** the exit code MUST be `1` and diagnostics MUST name the path plus expected and observed hash envelopes

#### Scenario: Missing deployed file fails CI audit
- **WHEN** the lock lists a deployed path that is absent on disk and `audit --ci` runs
- **THEN** the exit code MUST be `1`

### Requirement: tree_sha256 is soft for M6 accept
Writing and auditing `tree_sha256` (OpenAPM lk-015) is SHOULD/soft for M6. Absence or incomplete tree hash coverage MUST NOT by itself block M6 acceptance; if deferred, validation notes MUST state the gap toward M7/M8.

#### Scenario: Missing tree_sha256 does not fail M6 CI gate alone
- **WHEN** `audit --ci` runs on a lock with git entries lacking `tree_sha256` but otherwise clean (lock present, deployed hashes OK)
- **THEN** the run MUST still be allowed to exit `0` for the M6 CI subset unless a separate tree-hash check is explicitly enabled later
