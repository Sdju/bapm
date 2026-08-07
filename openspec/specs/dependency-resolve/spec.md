# dependency-resolve Specification

## Purpose

Defines transitive dependency classify, BFS resolve, modules-cache download, and lock populate for `@bapm/core` so `resolveAndLock` matches OpenAPM §7 M3 baseline (git + local) without target deploy or registry HTTP fetch.

## Requirements

### Requirement: Classify dependency kinds per OpenAPM order
The system MUST classify each dependency declaration into one of: `local`, `registry`, `git-semver`, `git-literal` (and MAY recognize marketplace as non-normative). Classification MUST follow OpenAPM kind precedence: local → registry → git-semver → git-literal (req-rs-008), except that an explicit marketplace string/object form MUST classify as `marketplace` before being mistaken for registry or git. Git refs MUST be classified as semver range, literal, or none (req-rs-003). A string beginning with `./`, `../`, `/`, `~/`, `.\\`, `..\\`, or `~\\`, and an object with a string `path` and no higher-precedence source discriminator, MUST classify as `local`; slash direction MUST NOT change this classification.

#### Scenario: Local path kind
- **WHEN** a dependency uses `path:` / local-path form and has no `git:` / registry `id:`
- **THEN** the classified kind MUST be `local`

#### Scenario: Explicit POSIX and Windows local prefixes classify as local
- **WHEN** a dependency string starts with any supported local prefix, including a backslash-delimited prefix
- **THEN** it MUST classify as `local` rather than registry, git, or marketplace

### Requirement: Resolve local dependencies within the project root
Local dependency resolution MUST convert backslash-delimited path syntax to POSIX segments before lexical normalization, resolve relative references from the declaring package directory, and permit a normalized target only when it remains within the root project's lexical path boundary. Root declarations use the project root as their declaring directory; each transitive local declaration uses the resolved parent package directory. Normalization MUST permit in-root dot-segment reduction such as `./a/../b` and transitive `../sibling` when the resulting target remains within the root. Absolute and home-prefixed references MUST be recognized as local and evaluated by the same containment rule; this requirement does not introduce a separate blanket prohibition for those forms.

#### Scenario: In-root normalization succeeds
- **WHEN** a root declaration references `./a/../b` and the normalized target is under the project root
- **THEN** the resolver MUST read and resolve package `b` as a local dependency

#### Scenario: Transitive sibling stays in root
- **WHEN** a local package declares `../sibling` relative to its own package directory and that sibling is under the project root
- **THEN** the resolver MUST include the sibling in the graph at the transitive depth

#### Scenario: Escape is refused before side effects
- **WHEN** a direct or transitive local reference normalizes outside the project root, including a backslash-delimited escape
- **THEN** resolution MUST fail with `LOCAL_PATH_ESCAPES_PROJECT_ROOT`, include the original reference in diagnostics, and perform no manifest read, downloader call, registry/git/marketplace fallback, policy evaluation, materialization, or lock write for that rejected edge

#### Scenario: Absolute and home forms are not classification bans
- **WHEN** an absolute or home-prefixed dependency reference is supplied
- **THEN** the resolver MUST classify it as local and apply project-root containment instead of rejecting it solely because of its prefix

#### Scenario: Git-literal kind
- **WHEN** a dependency is `repo#main` or an object with a literal `ref:` (branch, tag name without semver range, or commit)
- **THEN** the classified kind MUST be `git-literal`

#### Scenario: Git-semver kind
- **WHEN** a dependency provides `ref:` as a node-semver range (for example `^1.2.0`)
- **THEN** the classified kind MUST be `git-semver`

#### Scenario: Registry kind uses registry fetch path
- **WHEN** a dependency provides registry `id:` (and registry coordinates)
- **THEN** the classified kind MUST be `registry`, and resolve/download MUST use the registry HTTP client path (see `registry-resolve-install`) and MUST NOT silently fall back to git

#### Scenario: Marketplace kind is resolved not fail-closed
- **WHEN** a dependency classifies as `marketplace`
- **THEN** graph resolve MUST invoke marketplace plugin resolve and continue with the resulting concrete dependency kind rather than failing closed solely for marketplace kind

### Requirement: Classify marketplace string and object forms
Classification MUST recognize marketplace dependencies from (1) string form `NAME@MARKETPLACE[#ref]` when the marketplace ref parser matches, and (2) object form containing a string `marketplace` key with plugin `name` and optional `version`/`ref` selector. Matched marketplace deps MUST classify as `kind: "marketplace"` (OpenAPM non-normative). Strings that look like git `owner/repo` or paths MUST NOT be forced into marketplace kind solely because they contain `@` outside the marketplace ref grammar.

#### Scenario: String NAME@MARKETPLACE classifies as marketplace
- **WHEN** a dependency string `tools@acme` is classified
- **THEN** the classified kind MUST be `marketplace`

#### Scenario: Object marketplace form classifies as marketplace
- **WHEN** a dependency object `{ "name": "tools", "marketplace": "acme", "version": "v1" }` is classified
- **THEN** the classified kind MUST be `marketplace`

#### Scenario: Git owner/repo is not marketplace
- **WHEN** a dependency string `acme/tools#main` is classified
- **THEN** the classified kind MUST NOT be `marketplace`

### Requirement: Resolve marketplace dependencies into concrete kinds
When graph resolve encounters `kind: "marketplace"`, it MUST call marketplace plugin resolve (using `~/.bapm` registry + fetch/cache), replace the edge with the concrete git/local (or deferred-unsupported) result, continue BFS as for that concrete kind, and thread provenance into the lock write path for the resulting entry. Marketplace miss/fetch/unsupported-source MUST fail with clear diagnostics. Resolve MUST NOT silently treat a marketplace miss as bare git `owner/repo` without marketplace lookup.

#### Scenario: Marketplace dep continues as git after resolve
- **WHEN** the root declares `tools@acme` and marketplace resolve maps it to git coordinates
- **THEN** resolve MUST proceed along the git path and produce a lock entry carrying marketplace provenance fields

#### Scenario: Marketplace miss does not bare-git fallback
- **WHEN** marketplace resolve reports marketplace-not-found or plugin-not-found
- **THEN** graph resolve MUST fail with that class of error and MUST NOT install `NAME/MARKETPLACE` as a github repo shorthand

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
Successful `resolveAndLock` MUST write the lock through the existing Lockfile dual-read / write-back / fresh-default rules (same loaded filename; fresh create → `bapm.lock.yaml`; both brand lockfiles present → hard error). Emitted dependencies MUST satisfy OpenAPM sort and monotonic version policy from lockfile R/W. Each git pin MUST include a 40-hex `resolved_commit` and MUST include a computed `tree_sha256` envelope (OpenAPM req-lk-015) for the on-disk package tree after download. Local-path and registry-only entries remain exempt from `tree_sha256`. On direct-dep or resolve failure, the operation MUST NOT report success (prefer no partial success commit of the lock).

#### Scenario: Fresh lock defaults to bapm.lock.yaml
- **WHEN** `resolveAndLock` succeeds on a project with no lockfile
- **THEN** the written file MUST be `bapm.lock.yaml` and git entries MUST include `resolved_commit` and `tree_sha256`

#### Scenario: Write-back apm.lock.yaml
- **WHEN** only `apm.lock.yaml` is present and re-lock succeeds
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

### Requirement: Scoped update holds non-targeted pins
When resolve runs in update mode with an explicit package scope set, the resolver MUST re-resolve only the scoped package identities and their transitive subtrees. Lock pins for non-scoped direct dependencies MUST remain character-identical for identity and resolved commit/tag fields that define the pin. Full (unscoped) update mode MUST continue to re-resolve every direct dependency against current manifest constraints (rs-011/rs-012).

#### Scenario: Scoped update leaves sibling pin unchanged
- **WHEN** update-mode resolve is scoped to package A while B is also a direct dep
- **THEN** B's lock pin fields that define the pin MUST remain identical while A and its subtree MAY change

### Requirement: Update purge before re-download for git-semver (lk-010)
When update-mode resolve targets a direct git-semver dependency, the system MUST purge that dependency's modules install path before download/materialize so content is re-fetched even if the satisfying tag is unchanged (lk-010).

#### Scenario: Purge runs before download on update
- **WHEN** update mode targets a git-semver direct dep whose modules path exists
- **THEN** that path MUST be removed (or equivalently emptied) before the download step for that package runs

### Requirement: Registry resolve integrates with resolveAndLock
`resolveAndLock` and install resolve paths MUST support registry-sourced deps end-to-end when registries are configured: list → pick → download → lk-013 verify → materialize → lock populate. Git/local-only projects MUST remain unchanged in behavior.

#### Scenario: Registry dep resolves into modules and lock
- **WHEN** `resolveAndLock` runs on a project with a valid registries block and a registry dep against a mock registry
- **THEN** the package MUST appear under `apm_modules` and the lock MUST include registry `resolved_url` / `resolved_hash`

#### Scenario: Non-registry project unchanged
- **WHEN** `resolveAndLock` runs on a git/local-only project with no registry deps
- **THEN** behavior MUST match pre-M10 git/local resolve (no registry HTTP required)

### Requirement: Lock rewrite carries forward inventory top-level bags
When `resolveAndLock` rebuilds and writes a lockfile from a resolve graph, it MUST copy forward from the previously loaded lock document any present top-level inventory bags that the lock-only path does not reconcile from disk, including at least `mcp_servers`, `mcp_configs`, `mcp_target_servers`, and `mcp_config_provenance`, and when present also `lsp_*`, `deployments`, and other unknown / `x-*` top-level keys already retained by serialize. Carry-forward MUST preserve recorded shapes opaquely (no reshape of `mcp_servers` map vs list). Lock-only rewrite MUST NOT invent MCP inventory from harness disk when those bags are absent. Per-dependency `deployed_file_hashes` and top-level `local_deployed_file_hashes` carry-forward MUST remain. OpenAPM `tree_sha256` computation on git entries (lk-015) MUST NOT be weakened.

#### Scenario: mcp_* bags survive bare lock rewrite
- **WHEN** an existing lockfile contains `mcp_servers` (and related `mcp_*` fields) written by a prior install, and `resolveAndLock` / bare `lock` rewrites the lock successfully
- **THEN** the new lockfile MUST still contain those `mcp_*` fields with equivalent recorded content

#### Scenario: Absent MCP is not invented on lock-only
- **WHEN** the existing lock has no `mcp_*` bags and lock rewrite runs without an MCP integrator
- **THEN** the written lock MUST NOT be required to invent empty `mcp_*` placeholders from disk

#### Scenario: deployed hashes still carried
- **WHEN** existing dependencies have `deployed_file_hashes` and lock rewrite keeps those identities
- **THEN** the rewritten entries MUST retain those hash maps

#### Scenario: tree_sha256 still computed for git pins
- **WHEN** `resolveAndLock` writes a git dependency after download
- **THEN** the emitted entry MUST include a computed `tree_sha256` envelope (lk-015)

### Requirement: Emit resolved_ref pin identity on git lock write
When `resolveAndLock` (or equivalent lock write after resolve) emits a git-literal or git-semver dependency entry, it MUST set APM-compatible `resolved_ref` to the concrete pin identity used for resolution: for git-literal, the classified ref string (branch name, tag name, or SHA as pinned; `HEAD` when the classification used default HEAD); for git-semver, the picked tag string when a tag is known (same value as `resolved_tag` when both are set). Emit MUST NOT drop `resolved_commit`, MUST NOT omit `tree_sha256` for git trees (lk-015), and MUST NOT weaken other OpenAPM lock requirements. Warm replay / update modes that rewrite git pins MUST keep emitting `resolved_ref` for newly written entries.

#### Scenario: Git-literal branch writes resolved_ref
- **WHEN** resolve succeeds for a dependency pinned to branch `feature/x`
- **THEN** the written lock entry MUST include `resolved_ref: feature/x` (or equivalent YAML) together with a 40-hex `resolved_commit`

#### Scenario: Git-semver writes resolved_ref equal to resolved_tag
- **WHEN** resolve succeeds for a git-semver dependency and picks tag `v1.2.0`
- **THEN** the written lock entry MUST include `resolved_tag: v1.2.0` and `resolved_ref` set to that same tag string, plus `constraint` and `resolved_commit`

#### Scenario: HEAD literal still records resolved_ref
- **WHEN** resolve succeeds for a git-literal dependency whose classified ref is absent or explicitly `HEAD`
- **THEN** the written lock entry MUST include `resolved_ref` of `HEAD` (or the documented default ref string used for resolve) with `resolved_commit`

### Requirement: Root resolve includes devDependencies.apm
When resolving the project root graph for local install (and equivalent resolveAndLock / install resolve paths), the resolver MUST treat entries under `devDependencies.apm` as root APM dependencies alongside `dependencies.apm` (union; declaration-order semantics MUST remain deterministic and documented). Child package manifests MUST continue to contribute only their `dependencies` (not their `devDependencies`) to the transitive graph. Absence of `devDependencies` MUST behave as today (dependencies-only root). This inclusion MUST NOT imply that pack/export ships `devDependencies` (pack filtering remains a separate concern).

#### Scenario: Root devDependency is installed
- **WHEN** the project manifest lists a package only under `devDependencies.apm` and install/resolve runs without excluding that root set
- **THEN** the resolver MUST include that package in the root install graph and a successful non-frozen install MUST materialize it like other root APM deps

#### Scenario: Child devDependencies stay out of transitive graph
- **WHEN** a resolved child package manifest declares `devDependencies.apm`
- **THEN** those child `devDependencies` MUST NOT be pulled into the parent project’s transitive install graph solely as root-style deps of the child

### Requirement: Resolve git children use ambient credential suppress
When `resolveAndLock` (or equivalent resolve/download path) spawns git for ref listing, clone, fetch, or validate of a remote, the child process environment MUST be constructed per the git-ambient-suppress capability: suppress ambient platform token env for unselected classes, clear inherited Auth git config material, attach only the selected credential host-class material (if any), and refuse non-https git-HTTP credential attach except loopback / insecure exemption. Resolve MUST NOT spawn fetch/validate git children that inherit ambient `GITHUB_TOKEN` / `GH_TOKEN` / class PATs when another class is selected.

#### Scenario: Resolver git spawn suppresses unselected tokens
- **WHEN** resolve downloads or lists refs for a remote whose selected class is not github while `GITHUB_TOKEN` is present in the parent environment
- **THEN** the git child MUST NOT inherit that GitHub token for credential use

#### Scenario: Resolver https git may attach selected class
- **WHEN** resolve fetches an `https://` git remote and a selected-class credential exists
- **THEN** the child MAY receive that selected-class credential after ambient suppress
