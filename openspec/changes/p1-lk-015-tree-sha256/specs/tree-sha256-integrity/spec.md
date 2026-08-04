## Purpose

Defines OpenAPM §5.6.4 / req-lk-015 canonical git-tree SHA-256: compute, record on git-sourced lock entries, and fail-closed re-verify on frozen install and audit.

## ADDED Requirements

### Requirement: Canonical tree hash algorithm
The system MUST compute `tree_sha256` as the SHA-256 over the OpenAPM §5.6.4 canonical byte representation of a resolved package tree on disk:

```
<line>           ::= <mode-octal> SP <name-utf8> SP <blob-sha256-hex> LF
<canonical-tree> ::= <line>*   (entries sorted lexicographically by name)
```

`<mode-octal>` MUST be POSIX-style (`100644`, `100755`, `120000`, `040000`). Regular files use `100644` or `100755` (executable bit); symlinks use `120000` with blob bytes equal to the link target string; directories use `040000` with blob-sha256 equal to the SHA-256 of that subdirectory's canonical representation. Lines MUST be LF-terminated UTF-8; entries MUST sort byte-wise by name. The recorded envelope MUST be `sha256:` plus lowercase hex (req-lk-016). The walk MUST exclude a top-level or nested directory named exactly `.git` (working-tree content only; embedded git object store MUST NOT contribute).

#### Scenario: Deterministic hash for identical tree
- **WHEN** the same directory tree is hashed twice
- **THEN** both results MUST be identical `sha256:<64-hex>` envelopes

#### Scenario: Nested directory contributes recursive hash
- **WHEN** a tree contains a subdirectory with files
- **THEN** the parent entry for that directory MUST use mode `040000` and the subdirectory's canonical tree hash as its blob-sha256

#### Scenario: Dot-git directory excluded from hash
- **WHEN** a package tree contains a `.git` directory alongside other files
- **THEN** the computed `tree_sha256` MUST equal the hash of the same tree with `.git` removed

### Requirement: Record tree_sha256 on git lock write
When writing a lockfile after packages are on disk under the modules directory, every **git-sourced** dependency entry (git-literal and git-semver; not local-path or registry-only) MUST include a computed `tree_sha256` envelope for that package's install tree (the package root under `apm_modules`, or the virtual subdirectory when a path fragment applies). Failure to compute MUST fail the lock write path closed (no success without the field).

#### Scenario: Fresh resolve records tree_sha256
- **WHEN** `resolveAndLock` or non-frozen install successfully locks a git dependency whose modules tree is present
- **THEN** that lock entry MUST include `tree_sha256` matching a recompute of the same tree

#### Scenario: Local and registry entries skip tree_sha256 requirement
- **WHEN** a lock entry is local-path or registry-sourced without a git tree
- **THEN** the system MUST NOT require `tree_sha256` for that entry under this capability

### Requirement: Re-verify tree_sha256 on frozen and audit
On frozen install and on `audit` / `audit --ci`, for every git-sourced lock entry that has (or MUST have) `tree_sha256`, the system MUST re-compute the hash from the on-disk package tree and MUST fail closed when the field is missing or the recomputed envelope differs from the recorded value. Diagnostics MUST name the entry (at least `name` or `repo_url`), the expected envelope, and the observed envelope (observed MAY be omitted only when the tree is missing and computation cannot run — then the diagnostic MUST still state absence/mismatch clearly).

#### Scenario: Mismatch fails frozen
- **WHEN** frozen install runs and a git entry's on-disk tree hash differs from recorded `tree_sha256`
- **THEN** install MUST fail closed without rewriting the lockfile

#### Scenario: Missing tree_sha256 fails audit CI
- **WHEN** `audit --ci` runs on a lock with a git-sourced entry lacking `tree_sha256`
- **THEN** the exit code MUST be non-zero and diagnostics MUST name the entry

#### Scenario: Matching tree_sha256 passes audit with clean deployed hashes
- **WHEN** `audit --ci` runs on a lock whose git entries have matching `tree_sha256` and deployed hashes are clean
- **THEN** the exit code MUST be `0`
