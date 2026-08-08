## MODIFIED Requirements

### Requirement: Basic frozen gate before mutation

When frozen mode is active, install MUST fail closed before modules, lock, or target harness writes if the lockfile is absent or a direct dependency pin is missing. On a successful frozen path, the lockfile bytes MUST remain unchanged (ignore atime). Combining frozen with an update/re-resolve flag MUST be rejected. MCP freeze checks MAY stub if MCP install is out of scope. When `deployed_file_hashes` are present in the lock, frozen install MUST also re-verify those hashes (lk-017 lite) as specified by the deployed-hash requirement. Frozen install MUST also re-verify `tree_sha256` for every git-sourced lock entry (OpenAPM req-lk-015) as specified by the tree-sha256 frozen requirement. Effective frozen mode includes both explicit frozen requests and CI-default frozen (OpenAPM req-lk-018) as specified by the CI-default frozen requirement.

#### Scenario: Frozen missing lock fails before writes

- **WHEN** install runs with frozen mode and no lockfile
- **THEN** it MUST fail before any modules, lock, or target harness writes

#### Scenario: Frozen missing direct pin fails closed

- **WHEN** install runs with frozen mode and the lock lacks a required direct dependency pin
- **THEN** it MUST fail closed without rewriting the lock

#### Scenario: Frozen success leaves lock bytes unchanged

- **WHEN** install runs with frozen mode against a valid lock and succeeds or no-ops
- **THEN** the lockfile bytes MUST remain unchanged (atime ignored)

#### Scenario: Frozen rejects update-refs

- **WHEN** install is invoked with frozen mode combined with an update/re-resolve flag
- **THEN** the invocation MUST be rejected without mutation

## ADDED Requirements

### Requirement: CI environment defaults install to frozen

Install MUST treat the process as frozen when the `CI` environment variable is truthy per OpenAPM req-lk-018 — present and not the literal strings `""`, `"0"`, or `"false"` (case-insensitive) — unless the caller explicitly opts out of frozen mode. Explicit frozen requests MUST still activate frozen mode regardless of `CI`. When CI-default or explicit frozen is effective, all existing frozen gates (missing lock/pins, lock immutability, deployed-hash and `tree_sha256` re-verify, reject update/re-resolve) MUST apply identically. An explicit non-frozen opt-out under a truthy `CI` MUST run the non-frozen install path (lock write-back allowed when otherwise permitted). Absent or non-truthy `CI` MUST leave the default non-frozen unless frozen is requested explicitly.

#### Scenario: Truthful CI defaults to frozen without explicit flag

- **WHEN** install runs with `CI=true` (or another OpenAPM-truthy `CI` value) and without an explicit non-frozen opt-out
- **THEN** install MUST behave as frozen (fail closed without lock when lock is absent; no lock rewrite on success)

#### Scenario: Explicit non-frozen opt-out under CI

- **WHEN** install runs with a truthy `CI` and an explicit non-frozen opt-out
- **THEN** install MUST NOT apply frozen gates solely due to `CI` and MAY write or update the lockfile on a successful non-frozen path

#### Scenario: Non-truthy CI stays non-frozen by default

- **WHEN** install runs with `CI` unset, empty, `0`, or `false` (any case) and without `--frozen`
- **THEN** install MUST use the non-frozen path by default

#### Scenario: CI-default frozen rejects update

- **WHEN** install runs with a truthy `CI`, no non-frozen opt-out, and an update/re-resolve flag
- **THEN** the invocation MUST be rejected without mutation
