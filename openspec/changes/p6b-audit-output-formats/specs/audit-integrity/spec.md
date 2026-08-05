## ADDED Requirements

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
