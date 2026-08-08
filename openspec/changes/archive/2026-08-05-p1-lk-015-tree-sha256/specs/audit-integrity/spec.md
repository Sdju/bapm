## REMOVED Requirements

### Requirement: tree_sha256 is soft for M6 accept

**Reason**: Soft M6 deferral closed; OpenAPM req-lk-015 is now enforced for Consumer claim progress.
**Migration**: Use the added requirement `tree_sha256 is required for audit CI on git entries` and the `tree-sha256-integrity` capability.

## ADDED Requirements

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
