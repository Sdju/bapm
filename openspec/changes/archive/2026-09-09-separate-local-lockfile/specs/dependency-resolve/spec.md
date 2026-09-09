## MODIFIED Requirements

### Requirement: Populate lock via M2 dual-read write rules

Successful `resolveAndLock` MUST write the shared lock through the existing Lockfile dual-read / write-back / fresh-default rules (same loaded filename; fresh create → `bapm.lock.yaml`; both brand lockfiles present → hard error). When the resolve graph includes personal-scope dependencies (bapm `local` source discriminator), the operation MUST also partition-write those entries to `bapm.local.lock.yaml` per `lockfile-local-shared-split` and MUST NOT leave them in the shared lock after success. Emitted dependencies in each file MUST satisfy OpenAPM sort and monotonic version policy from lockfile R/W. Each git pin MUST include a 40-hex `resolved_commit` and MUST include a computed `tree_sha256` envelope (OpenAPM req-lk-015) for the on-disk package tree after download. Local-path and registry-only entries remain exempt from `tree_sha256`. On direct-dep or resolve failure, the operation MUST NOT report success (prefer no partial success commit of either lock half).

#### Scenario: Fresh lock defaults to bapm.lock.yaml

- **WHEN** `resolveAndLock` succeeds on a project with no lockfile and only shared-scope dependencies
- **THEN** the written shared file MUST be `bapm.lock.yaml` and git entries MUST include `resolved_commit` and `tree_sha256`

#### Scenario: Write-back apm.lock.yaml

- **WHEN** only `apm.lock.yaml` is present and re-lock succeeds with shared-scope deps
- **THEN** the system MUST update `apm.lock.yaml` and MUST NOT create a sibling `bapm.lock.yaml`

#### Scenario: Dual lock filenames hard error

- **WHEN** both `apm.lock.yaml` and `bapm.lock.yaml` exist
- **THEN** `resolveAndLock` MUST fail with a dual-conflict error before claiming success

#### Scenario: Direct dep failure is non-success

- **WHEN** a direct dependency cannot be resolved or downloaded (for example broken git URL)
- **THEN** the operation MUST fail (thrown error or non-success result) and MUST NOT present a successful lock write

#### Scenario: Git pin records tree_sha256

- **WHEN** `resolveAndLock` successfully downloads a git dependency into modules
- **THEN** the written lock entry for that dependency MUST include `tree_sha256` matching a recompute of that package tree

#### Scenario: Local discriminator dual-writes personal lock

- **WHEN** `resolveAndLock` succeeds on a graph that includes a bapm `local` source dependency and a git dependency
- **THEN** the git pin MUST be in the shared lockfile and the `local` pin MUST be in `bapm.local.lock.yaml`
