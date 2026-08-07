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

### Requirement: Shared trust classification for audit twin

Audit (or an equivalent trust classifier invoked by audit Mode B / CI paths) MUST classify MCP executable trust using the same layered deny-wins resolver as the install MCP gate. For identical org, project, user, package, and MCP-type inputs, the classification outcome MUST match install.

#### Scenario: Twin outcome on shared fixtures

- **WHEN** the same layered inputs are evaluated by install gate and by the audit/trust classifier
- **THEN** both MUST report the same allow, deny, or withhold outcome for that package's MCP

### Requirement: Required package presence from lockfile

When evaluating governance `dependencies.require` for audit/presence fidelity (sc-012), package presence MUST be satisfied from **resolved lockfile** membership. Presence MUST NOT fail solely because MCP (or other executables) for that package were withheld from deploy.

#### Scenario: Present in lock satisfies require despite withheld MCP

- **WHEN** policy requires package `org/base`, the lockfile lists `org/base`, and MCP for `org/base` is withheld by the trust resolver
- **THEN** require presence MUST be satisfied and MUST NOT emit a missing-package / `POLICY_REQUIRE` failure for that package solely due to withhold

#### Scenario: Missing from lock fails require presence

- **WHEN** policy requires package `org/base` and the lockfile does not list `org/base`
- **THEN** presence evaluation MUST report a missing/required-package failure distinct from an executable-withheld diagnostic

### Requirement: Distinct withheld diagnostic for present required package

When a required package is present in the lockfile and MCP for that package is withheld, the system MUST emit a diagnostic with a stable code/name that is **distinct** from `POLICY_REQUIRE` and from missing-package failures.

#### Scenario: Withheld code differs from POLICY_REQUIRE

- **WHEN** a required package is lock-present and MCP is withheld
- **THEN** diagnostics MUST include a withheld/trust code that is not `POLICY_REQUIRE` and MUST NOT classify the package as missing
