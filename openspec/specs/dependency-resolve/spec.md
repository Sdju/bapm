# dependency-resolve Specification

## Purpose

Defines transitive dependency classify, BFS resolve, modules-cache download, and lock populate for `@bapm/core` so `resolveAndLock` matches OpenAPM §7 M3 baseline (git + local) without target deploy or registry HTTP fetch.

## Requirements

### Requirement: Classify dependency kinds per OpenAPM order
The system MUST classify each dependency declaration into one of: `local`, `registry`, `git-semver`, `git-literal` (and MAY recognize marketplace as non-normative). Classification MUST follow OpenAPM kind precedence: local → registry → git-semver → git-literal (req-rs-008). Git refs MUST be classified as semver range, literal, or none (req-rs-003).

#### Scenario: Local path kind
- **WHEN** a dependency uses `path:` / local-path form and has no `git:` / registry `id:`
- **THEN** the classified kind MUST be `local`

#### Scenario: Git-literal kind
- **WHEN** a dependency is `repo#main` or an object with a literal `ref:` (branch, tag name without semver range, or commit)
- **THEN** the classified kind MUST be `git-literal`

#### Scenario: Git-semver kind
- **WHEN** a dependency provides `ref:` as a node-semver range (for example `^1.2.0`)
- **THEN** the classified kind MUST be `git-semver`

#### Scenario: Registry kind without fetch client
- **WHEN** a dependency provides registry `id:` (and registry coordinates)
- **THEN** the classified kind MUST be `registry`, and resolve/download MUST fail closed with a diagnostic that names registry fetch as deferred/unsupported (MUST NOT silently fall back to git)

### Requirement: Refuse nest conflict resolution
When the project manifest sets `dependencies.conflict_resolution` to `nest`, resolve MUST fail with a diagnostic that cites nest / reserved for a later OpenAPM version (req-rs-013).

#### Scenario: Nest refused
- **WHEN** resolve runs against a manifest with `dependencies.conflict_resolution: nest`
- **THEN** resolve MUST fail and MUST NOT produce a successful lock write

### Requirement: BFS resolve with declaration order and depth cap
Resolve MUST walk the dependency graph breadth-first, respecting declaration order among siblings at the same depth (req-rs-001). Default maximum depth MUST be 50; exceeding it MUST fail with a diagnostic that names the chain (req-rs-006). Circular dependencies MUST fail closed with a cycle diagnostic.

#### Scenario: Declaration order at depth one
- **WHEN** the root declares direct deps A then B
- **THEN** the walk at depth 1 MUST visit A before B

#### Scenario: Depth cap exceeded
- **WHEN** a dependency chain exceeds depth 50
- **THEN** resolve MUST fail and the diagnostic MUST identify the chain

#### Scenario: Circular dependencies fail closed
- **WHEN** the graph contains a cycle (A→B→A)
- **THEN** resolve MUST fail with a cycle diagnostic

### Requirement: Diamond conflicts use intersection-pick
For diamonds to the same package identity, the system MUST use OpenAPM intersection-pick (highest version in the intersection of constraints), MUST fail closed on empty intersection, and MUST NOT use APM first-wins (req-rs-001). Empty-intersection diagnostics MUST list both chains using `owner/repo@constraint` segments joined by `->` (req-rs-010). The winning entry's `resolved_by` MUST reflect the tightest-constraint chain.

#### Scenario: Overlapping ranges pick intersection winner
- **WHEN** two paths reach the same identity with overlapping semver ranges
- **THEN** resolve MUST select a single winner equal to the highest version in the intersection

#### Scenario: Empty intersection fails with both chains
- **WHEN** two paths reach the same identity with non-overlapping constraints
- **THEN** resolve MUST fail and the diagnostic MUST list both chains joined with `->`

### Requirement: Git-semver pin using node-semver dialect
For `git-semver`, the system MUST list candidate tags, peel to commits, filter by the range using the node-semver dialect (req-rs-007), exclude prereleases unless the range opts in, pin the highest satisfying tag (req-rs-002), and apply build-metadata ties by highest ASCII tag name (req-rs-014). Lock entries MUST populate `constraint`, `resolved_tag`, `resolved_at`, and `resolved_commit` (req-lk-008). Tag listing MAY be supplied by an injectable port for fixture tests.

#### Scenario: Highest tag in range pinned
- **WHEN** fake remote tags include `v1.2.0` and `v1.3.0` and the constraint is `^1.2.0`
- **THEN** the pin MUST be the highest satisfying tag and the lock entry MUST include `constraint`, `resolved_tag`, `resolved_at`, and `resolved_commit`

#### Scenario: Prerelease excluded without opt-in
- **WHEN** tags include `1.2.0-beta` and the range is `^1.2.0` without prerelease opt-in
- **THEN** the beta tag MUST NOT be selected

#### Scenario: Semver dialect oracle
- **WHEN** ranges and versions from the OpenAPM `semver-dialect.json` oracle are evaluated
- **THEN** results MUST match the oracle (req-rs-007 / req-rs-014)

### Requirement: Minimum safe repo identity for cache and resolve
Git repo identity for resolve/cache/materialize MUST normalize host case and trailing `.git` so equivalent URLs share identity; path-case differences MUST remain distinct by default; cache keys MUST NOT isolate solely by ref (req-rs-016).

#### Scenario: URL normalize same identity
- **WHEN** two URLs differ only by host case or a trailing `.git`
- **THEN** they MUST share the same minimum repo identity key

### Requirement: Warm lock replay and semver constraint drift
When a lock entry has `resolved_commit` for a git-literal (or equivalent warm pin) and the manifest ref is unchanged, resolve without update MUST reuse the pin without network ref-resolution (req-rs-015); object fetch for missing modules cache MAY still run. When lock `constraint` is not character-equal to the manifest range, resolve MUST re-resolve (req-rs-004). An explicit update mode MUST re-resolve refs to the latest satisfying constraint.

#### Scenario: Warm replay skips ref network
- **WHEN** lock has a git-literal `resolved_commit` and the manifest ref is unchanged and update is off
- **THEN** resolve MUST reuse the pin without `ls-remote` / tag listing for that ref

#### Scenario: Constraint drift forces re-resolve
- **WHEN** lock `constraint` is `^1.0.0` but the manifest range is now `^2.0.0`
- **THEN** resolve MUST re-resolve rather than keep the stale pin

#### Scenario: Update mode moves pin
- **WHEN** update mode is on and a newer remote ref satisfies the constraint
- **THEN** the written pin MUST move to the latest satisfying result

### Requirement: Modules directory name is apm_modules
Materialized packages MUST be placed under a project-relative modules directory named `apm_modules` for APM wire/drop-in parity. The constant MUST be documented as the M3 default; a `bapm_modules` alias is NOT required in M3.

#### Scenario: Download lands under apm_modules
- **WHEN** resolveAndLock downloads a git package into the modules cache
- **THEN** the package tree MUST appear under `<projectRoot>/apm_modules/` (or a documented layout beneath that root)

### Requirement: Download into modules cache without target deploy
`resolveAndLock` MUST download/materialize missing packages into the modules directory so pins are backed by real trees (local deps use path copy/link without network). It MUST NOT detect agent targets, MUST NOT copy or delete primitives under harness dirs (for example `.github/`, `.agents/`), and MUST NOT run install cleanup/gitignore/post-deps/audit side effects. Policy gates MUST be skipped until a later policy milestone (M8).

#### Scenario: No harness deploy on lock
- **WHEN** `resolveAndLock` runs on a project that already has agent harness directories
- **THEN** those harness directories MUST remain unchanged aside from modules-cache and lockfile writes

#### Scenario: Local transitive appears in graph and lock
- **WHEN** root depends on a local package that itself depends on another local or git package
- **THEN** both MUST appear in the resolved graph with correct depth / `resolved_by`, and both MUST be representable in the written lock

### Requirement: Populate lock via M2 dual-read write rules
Successful `resolveAndLock` MUST write the lock through the existing Lockfile dual-read / write-back / fresh-default rules (same loaded filename; fresh create → `bapm.lock.yaml`; both brand lockfiles present → hard error). Emitted dependencies MUST satisfy OpenAPM sort and monotonic version policy from lockfile R/W. Each git pin MUST include a 40-hex `resolved_commit` at minimum; content/`tree_sha256` MAY be omitted in M3 when not cheaply available after download. On direct-dep or resolve failure, the operation MUST NOT report success (prefer no partial success commit of the lock).

#### Scenario: Fresh lock defaults to bapm.lock.yaml
- **WHEN** `resolveAndLock` succeeds on a project with no lockfile
- **THEN** the written file MUST be `bapm.lock.yaml` and git entries MUST include `resolved_commit`

#### Scenario: Write-back apm.lock.yaml
- **WHEN** only `apm.lock.yaml` is present and re-lock succeeds
- **THEN** the system MUST update `apm.lock.yaml` and MUST NOT create a sibling `bapm.lock.yaml`

#### Scenario: Dual lock filenames hard error
- **WHEN** both `apm.lock.yaml` and `bapm.lock.yaml` exist
- **THEN** `resolveAndLock` MUST fail with a dual-conflict error before claiming success

#### Scenario: Direct dep failure is non-success
- **WHEN** a direct dependency cannot be resolved or downloaded (for example broken git URL)
- **THEN** the operation MUST fail (thrown error or non-success result) and MUST NOT present a successful lock write
