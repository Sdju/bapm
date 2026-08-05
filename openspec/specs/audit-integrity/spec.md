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

### Requirement: tree_sha256 is required for audit CI on git entries
Writing and auditing `tree_sha256` (OpenAPM lk-015) is a MUST for Consumer integrity. For every git-sourced lock entry, `audit --ci` MUST require a recorded `tree_sha256` and MUST re-compute the canonical tree hash from the on-disk package tree under the modules directory. Missing field, missing package tree, or envelope mismatch MUST yield exit code `1` with a diagnostic naming the entry, expected envelope (when recorded), and observed envelope (when computable). Local-path and registry-only entries MUST NOT fail solely for absence of `tree_sha256`. Deployed-file hash checks (lk-017) remain in force unchanged.

#### Scenario: Missing tree_sha256 fails CI gate for git entry
- **WHEN** `audit --ci` runs on a lock with a git entry lacking `tree_sha256` but otherwise clean deployed hashes
- **THEN** the run MUST exit non-zero and diagnostics MUST name the entry

#### Scenario: Mismatched tree_sha256 fails CI gate
- **WHEN** `audit --ci` runs and the recomputed tree hash for a git entry differs from the recorded `tree_sha256`
- **THEN** the run MUST exit `1` and diagnostics MUST include expected and observed envelopes

#### Scenario: Matching tree_sha256 with clean deployed hashes exits zero
- **WHEN** lock git entries have matching `tree_sha256`, deployed hashes verify, and `audit --ci` runs
- **THEN** the exit code MUST be `0`

### Requirement: Structured audit formats preserve integrity exit contract
When `audit --ci` emits `text`, `json`, or `sarif`, the exit code MUST remain `0` when the integrity gate is clean and `1` when any lock / deployed-hash (lk-017) / `tree_sha256` (lk-015) violation would fail text mode today. Choosing a structured format MUST NOT soften missing lock, hash mismatch, missing deployed file, or missing/mismatched `tree_sha256` into a zero exit. Format serialization MUST NOT rewrite the lockfile, mutate modules, or skip re-verification.

#### Scenario: json format still fails on tampered deployed file
- **WHEN** a recorded deployed file's content differs from `deployed_file_hashes` and `audit --ci -f json` runs
- **THEN** the exit code MUST be `1` and the JSON MUST have `passed: false`

#### Scenario: sarif format still fails on missing tree_sha256
- **WHEN** `audit --ci -f sarif` runs on a lock with a git entry lacking `tree_sha256`
- **THEN** the exit code MUST be non-zero and SARIF results MUST include a `tree-sha256` rule failure

#### Scenario: text mode unchanged on clean inventory
- **WHEN** lock is consistent, hashes and tree verify, and `audit --ci` runs with default text format
- **THEN** the exit code MUST be `0`
