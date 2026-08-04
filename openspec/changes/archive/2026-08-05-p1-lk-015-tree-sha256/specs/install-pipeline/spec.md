## MODIFIED Requirements

### Requirement: Basic frozen gate before mutation
When frozen mode is active, install MUST fail closed before modules, lock, or target harness writes if the lockfile is absent or a direct dependency pin is missing. On a successful frozen path, the lockfile bytes MUST remain unchanged (ignore atime). Combining frozen with an update/re-resolve flag MUST be rejected. MCP freeze checks MAY stub if MCP install is out of scope. When `deployed_file_hashes` are present in the lock, frozen install MUST also re-verify those hashes (lk-017 lite) as specified by the deployed-hash requirement. Frozen install MUST also re-verify `tree_sha256` for every git-sourced lock entry (OpenAPM req-lk-015) as specified by the tree-sha256 frozen requirement. Default-frozen-on-CI (lk-018) remains optional (deferred to a later stage).

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

### Requirement: Frozen re-verifies tree_sha256 for git entries
When frozen mode is active, for every git-sourced lock dependency the system MUST require a recorded `tree_sha256`, MUST ensure the package tree is present under the modules directory (or fail closed), MUST re-compute the canonical tree hash, and MUST fail closed on missing field or envelope mismatch. Diagnostics MUST name the entry and expected/observed envelopes when available. Lock bytes MUST NOT be rewritten on this failure path.

#### Scenario: Tampered modules tree fails frozen
- **WHEN** install runs with `--frozen` and a git entry's modules tree content differs from recorded `tree_sha256`
- **THEN** install MUST fail closed and MUST NOT rewrite the lockfile

#### Scenario: Missing tree_sha256 on git entry fails frozen
- **WHEN** install runs with `--frozen` and a git lock entry lacks `tree_sha256`
- **THEN** install MUST fail closed before treating the run as successful
