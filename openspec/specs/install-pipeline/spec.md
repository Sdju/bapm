# install-pipeline Specification

## Purpose

Defines `@bapm/core` install orchestration after M3 resolve/download: modules placement, lock write-back unless frozen, target intersection and deploy only through registered `@bapm/integration-api` contracts, and basic OpenAPM frozen gate (lk-006).

## Requirements

### Requirement: Install places modules and writes lock when not frozen

Non-frozen install MUST ensure resolved packages are present under the modules directory (reuse M3 resolve/download path) and MUST write or update the lockfile per M2 dual-read/write-back rules. Fresh install with only a manifest MUST create modules and a lockfile.

#### Scenario: Warm install places modules

- **WHEN** install runs non-frozen with an existing lock and resolvable git/local deps
- **THEN** packages MUST be present under the modules directory and lock write-back MUST follow M2 dual-read rules

#### Scenario: Fresh install writes lock

- **WHEN** install runs non-frozen with a manifest and no lockfile
- **THEN** modules MUST be created and a lockfile MUST be written

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

### Requirement: Frozen re-verifies tree_sha256 for git entries

When frozen mode is active, for every git-sourced lock dependency the system MUST require a recorded `tree_sha256`, MUST ensure the package tree is present under the modules directory (or fail closed), MUST re-compute the canonical tree hash, and MUST fail closed on missing field or envelope mismatch. Diagnostics MUST name the entry and expected/observed envelopes when available. Lock bytes MUST NOT be rewritten on this failure path.

#### Scenario: Tampered modules tree fails frozen

- **WHEN** install runs with `--frozen` and a git entry's modules tree content differs from recorded `tree_sha256`
- **THEN** install MUST fail closed and MUST NOT rewrite the lockfile

#### Scenario: Missing tree_sha256 on git entry fails frozen

- **WHEN** install runs with `--frozen` and a git lock entry lacks `tree_sha256`
- **THEN** install MUST fail closed before treating the run as successful

### Requirement: Write deployed file hashes after materialize

When install materializes harness files through a registered target and is not in a path that forbids lock mutation, install MUST record `deployed_file_hashes` (per dependency and/or document-level fields already modeled by the lockfile schema) for the paths reported by materialize. Hash algorithm MUST be documented and stable enough for byte re-verify on a subsequent frozen install.

#### Scenario: Lock gains hashes after deploy

- **WHEN** a non-frozen install deploys cursor skills/rules/agents and writes lock write-back
- **THEN** the lockfile MUST include `deployed_file_hashes` entries covering the deployed harness paths for the relevant dependency inventory

### Requirement: Orphan cleanup for removed dependency deploy inventory

When the previous lock lists deployed harness paths (via `deployed_file_hashes` or equivalent inventory) for a dependency that is no longer in the resolved install set, install MUST remove those orphaned files (or fail closed with a documented reason if removal is unsafe). Cleanup MUST NOT delete files outside previously recorded inventory paths.

#### Scenario: Removed dep cleans recorded harness files

- **WHEN** lock inventory lists deployed files for dependency X and the next install no longer includes X
- **THEN** those recorded files MUST be removed (or the run MUST fail closed with a documented reason) and unrelated project files MUST remain untouched

### Requirement: Frozen re-verifies deployed file hashes when present

When frozen mode is active and the lock contains `deployed_file_hashes` for deployed harness files, install MUST re-verify on-disk content against those hashes (lk-017 lite) and MUST fail closed if a recorded file is missing or its content hash mismatches. If the lock has no deployed hash inventory, install MUST NOT invent a pass for tampered harness files beyond existing lk-006 pin checks.

#### Scenario: Tampered deployed file fails frozen

- **WHEN** install runs with `--frozen`, the lock has `deployed_file_hashes`, and a recorded harness file on disk has been altered
- **THEN** install MUST fail before treating the run as successful and MUST NOT rewrite the lockfile

### Requirement: Forced target activation without detect signal

Install MUST accept an explicit forced target id (for example from CLI `--target cursor`) when that id is registered. When forced, install MUST invoke that target's materialize even if `detect` would be false, allowing creation of registered roots. Unknown forced target ids MUST be rejected with a clear error. Without a forced target and without a positive detect, install MUST still complete modules and lock work and MUST NOT write harness files (MAY warn).

#### Scenario: Force cursor without detect

- **WHEN** install is invoked with forced target `cursor`, cursor is registered, and `.cursor/` is absent
- **THEN** materialize for cursor MUST run and MAY create registered deploy roots

#### Scenario: Unknown forced target rejected

- **WHEN** install is invoked with forced target id that is not registered
- **THEN** install MUST fail with a clear error and MUST NOT write harness files for that id

### Requirement: Deploy only via registered integration-api contracts

Core install MUST invoke host materialization only through `@bapm/integration-api` registration/contracts. Core MUST NOT hard-depend on `@bapm/integration-cursor` or any concrete `bapm-target-*` package. With no target registered or none detected, install MUST still complete modules and lock work and MUST NOT write harness files (MAY warn).

#### Scenario: No hard dependency on concrete target

- **WHEN** inspecting `@bapm/core` package dependencies
- **THEN** it MUST list `@bapm/integration-api` (or workspace equivalent) and MUST NOT list `@bapm/integration-cursor` or other concrete `bapm-target-*` packages

#### Scenario: Integrate without registered target

- **WHEN** install runs with no target registered and none detected
- **THEN** modules and lock MUST succeed and no harness deploy files MUST be written by core

#### Scenario: Materialize uses conflict-resolved set

- **WHEN** install integrates with an active registered target and discovered primitives
- **THEN** the target `materialize` contract MUST be invoked with the conflict-resolved primitive set, not raw duplicates

#### Scenario: Core does not write harness paths itself

- **WHEN** install runs with a mock/spy target registered via the API
- **THEN** only the registered target implementation MUST perform writes under its declared deploy roots

### Requirement: target and targets mutual exclusion and intersection

Manifest parsing/install MUST hard-error when both `target` and `targets` fields are present (OpenAPM tg-008), for legacy string/array forms and for object-map forms. When integrating, primitives from a package MUST be deployed only into the intersection of active project targets, consumer-authorized targets, and package-declared targets. Declared project target ids MUST be taken from: the single string when `target` is a string; each element when `targets` is a string array; or each key when `target` / `targets` is an object map. Vendor-style ids matching `x-<vendor>-<name>` MUST be accepted as target identifiers (tg-004); deploy MUST occur only if a package is registered for that id.

#### Scenario: Mutual exclusion of target fields

- **WHEN** a manifest contains both `target` and `targets`
- **THEN** parse or install MUST fail closed before deploy

#### Scenario: Intersection skips non-overlapping package targets

- **WHEN** the project active target is `cursor` and a dependency declares `targets: [copilot]`
- **THEN** that dependency's primitives MUST NOT be deployed to the cursor target

#### Scenario: Vendor target id accepted

- **WHEN** a manifest uses `target: x-acme-editor`
- **THEN** validation MUST accept the id as a vendor target id; deploy MUST happen only if that id is registered

#### Scenario: Object-map keys participate in intersection

- **WHEN** the project manifest declares object-map `targets` whose keys include `cursor` and a dependency declares `targets: [copilot]` only
- **THEN** that dependency's primitives MUST NOT be deployed to an active cursor target (non-overlapping declared ids)

### Requirement: Object-map target bindings do not load integrations

When the project manifest uses the object-map form of `target` or `targets`, install MUST use only the map **keys** as declared host ids for intersection and related filters. Map **values** (npm package specifiers) MUST be retained on the loaded document for future wiring and MUST NOT, in this capability slice, cause install to download, `require`, register, or otherwise activate an integration package. Active host selection MUST remain `--target` / forced target and registered auto-detect as already specified.

#### Scenario: Map values ignored for activation

- **WHEN** install runs with `targets: { cursor: "@bapm/integration-cursor" }` and cursor is already registered by the CLI the usual way
- **THEN** install MUST treat `cursor` as a declared host id for intersection and MUST NOT attempt to install or dynamically load `@bapm/integration-cursor` from the map value alone

#### Scenario: Declared ids from map keys

- **WHEN** a loaded manifest has object-map `targets` with keys `cursor` and `claude`
- **THEN** declared project target ids used for intersection MUST include `cursor` and `claude`

### Requirement: Deploy only under registered deploy roots

When a concrete target is active, all harness writes performed through that target MUST stay under the deploy root(s) registered for it (tg-002).

#### Scenario: Writes stay under registered roots

- **WHEN** an active target materializes primitives during install
- **THEN** every written harness path MUST be under that target's registered deploy root(s)

### Requirement: Deployed hash verify is reusable for audit CI

The deployed-file hash re-verify logic used by frozen install (lk-017 lite) MUST be reusable as a library/public helper so `audit --ci` can perform the same SHA-256 presence + hash checks without requiring a full frozen install mutation path. Audit MUST fail closed on missing recorded files or hash mismatch identically in spirit to frozen re-verify.

#### Scenario: Audit reuses hash verify semantics

- **WHEN** `audit --ci` runs against a lock with `deployed_file_hashes`
- **THEN** verification MUST apply the same hash algorithm and fail-closed rules as frozen install hash re-verify for those inventory entries

### Requirement: Uninstall and prune compose install cleanup helpers

Uninstall of removed deps and prune of orphan modules MUST reuse existing orphan/deployed-inventory cleanup patterns from Install where applicable (delete only recorded harness paths; do not wipe unregistered user files). Update after successful apply MAY compose non-frozen install/materialize so modules and deploy stay consistent with the new lock.

#### Scenario: Uninstall cleans recorded deploy inventory

- **WHEN** uninstall removes dep X that has `deployed_file_hashes` inventory
- **THEN** those recorded harness paths MUST be removed using inventory-scoped cleanup (not a full harness wipe)

### Requirement: Install accepts a local pack archive path

Install MUST accept a local filesystem path to a pack-produced plain zip as an install source. When the argument is such an archive, install MUST extract/consume the conforming layout (manifest at expected root; optional packed lock/primitives) into the target project directory and MUST make the resulting manifest dual-read parseable. On invalid archive layout or failing manifest validate, install MUST fail closed with non-zero exit. This path is the primary M7 round-trip for pack (unpack-equivalent). Full network resolve of archive-embedded deps MAY proceed via existing install orchestration after extract when dependencies are present.

#### Scenario: Install from pack zip lands manifest

- **WHEN** install is invoked with a path to a valid pack-produced zip containing `bapm.yml` (or `apm.yml`) at the expected root
- **THEN** the project output MUST contain a dual-read parseable manifest and the command MUST NOT treat the zip as an unknown package ref without attempting archive consume

#### Scenario: Corrupt archive fails closed

- **WHEN** install is invoked with a path that is not a valid pack zip layout
- **THEN** install MUST exit non-zero without claiming a successful archive install

### Requirement: Policy gate before download and materialize

Install orchestration MUST invoke policy discovery and evaluation against the resolved install plan before downloading packages into the modules directory and before target materialize/deploy for the proposed install. When the gate reports blocking violations, install MUST fail closed without those durable writes. When policy is absent or the caller opts out via no-policy/env disable, install MUST behave as before M8 (ungated). Preferred pipeline shape is resolve-plan → policy-gate → download → primitives/targets (OpenAPM pl-002 strict).

#### Scenario: Blocking policy stops before modules write

- **WHEN** install has a resolved plan that violates a blocking policy
- **THEN** install MUST NOT download/write new modules content for that plan and MUST NOT deploy target harness files for that plan

#### Scenario: Ungated path unchanged without policy

- **WHEN** install runs with no discovered policy and no explicit policy path
- **THEN** resolve/download/materialize MUST proceed under existing M3–M7 rules

### Requirement: Install options accept policy controls

Install public options MUST accept an explicit policy path/ref, a no-policy/disable flag, and MUST honor environment disable when wired by the CLI. Dual-conflict of local policy filenames MUST surface as install failure before durable writes.

#### Scenario: Explicit policy path on install

- **WHEN** install is invoked with an explicit policy path to a valid deny/block document matching a planned dep
- **THEN** that policy MUST be used for the gate even if sibling brand files exist

### Requirement: MCP deploy and trust after policy gate

After the M8 policy gate (when applicable) and before or as part of durable target harness writes, install MUST run executable MCP trust (sc-009) and Cursor MCP deploy for eligible servers when the cursor target is active. Blocking trust withhold MUST prevent writing the withheld MCP entries. Policy block MUST still stop modules/deploy before MCP writes. Projects without MCP MUST keep existing modules+skills paths unchanged.

#### Scenario: Policy block precedes MCP write

- **WHEN** install has a blocking policy violation on the plan
- **THEN** install MUST NOT write `.cursor/mcp.json` for that plan

#### Scenario: Trust withhold skips MCP entry

- **WHEN** policy allows the plan but sc-009 withholds a dependency's MCP
- **THEN** that MCP entry MUST NOT appear in `.cursor/mcp.json`

#### Scenario: Eligible MCP deploys with cursor active

- **WHEN** policy allows, trust approves (or no grant surface), cursor is active, and direct MCP exists
- **THEN** `.cursor/mcp.json` MUST be updated and lock `mcp_*` fields MUST reflect configured servers

### Requirement: MCP lock inventory is keyed by the configuring target

When a registered target successfully configures MCP and reports its configuration path, non-frozen install MUST record the MCP configuration inventory under that target's id and with that reported path. Core MUST NOT substitute a Cursor id or a Cursor filesystem path for a different target. Existing MCP inventory entries that were loaded from the lock but were not written by the current configure operation MUST be preserved unchanged.

#### Scenario: Non-Cursor target writes its own MCP inventory

- **WHEN** an active registered target with id `x-acme-editor` configures MCP and reports `config/mcp.json`
- **THEN** the updated lock MUST record `x-acme-editor` with `config/mcp.json` in its MCP configuration inventory and MUST NOT add a Cursor-path entry for that operation

#### Scenario: Existing legacy inventory is preserved

- **WHEN** a lock already contains a legacy MCP inventory entry and another registered target configures MCP
- **THEN** lock write-back MUST preserve the legacy entry unchanged while adding or updating the configuring target's inventory

#### Scenario: Configure without a path fails before lock write-back

- **WHEN** an active target reports successful MCP configuration without a non-empty project-relative path
- **THEN** install MUST fail without writing a replacement MCP inventory entry

### Requirement: Install accepts transitive MCP trust flag

Install options MUST accept an explicit trust-transitive-MCP flag (name MAY mirror APM `--trust-transitive-mcp`). Default MUST keep transitive MCP undeployed.

#### Scenario: Trust transitive flag enables transitive MCP

- **WHEN** install is invoked with the trust-transitive-MCP flag and a transitive MCP server is present with cursor active and trust allows
- **THEN** that transitive MCP MAY be deployed per documented rules

### Requirement: Install materializes registry packages after policy gate

When the resolved set includes registry-sourced packages, install MUST materialize verified registry archives into the modules directory using the registry-resolve-install path (lk-013 before extract). The M8 policy gate MUST still run before durable modules/lock/deploy writes. Git/local-only installs MUST remain unchanged.

#### Scenario: Registry install places modules with verified hash

- **WHEN** non-frozen install runs with a registry dep against a mock registry that serves matching digest bytes
- **THEN** the package MUST be present under modules and the lock MUST record `resolved_hash` matching those bytes

#### Scenario: Policy still blocks registry dep before writes

- **WHEN** install proposes a registry dep denied by policy in block mode
- **THEN** install MUST fail closed before modules/lock durable writes for that plan

#### Scenario: Digest mismatch leaves modules unchanged

- **WHEN** registry download bytes do not match advertised digest during install
- **THEN** install MUST fail closed and MUST NOT leave a successful partial extract for that package

### Requirement: Install dry-run performs zero durable project writes

Install public options MUST accept a dry-run flag. When dry-run is active, install MUST NOT perform durable writes under the project cwd for: manifest mutation, lock/inventory write-back, modules download materialize into the project modules tree, pack-archive extract into the project, orphan/deployed-file deletes, target `materialize`, or `configureMcp`. Preview MUST align with APM default: surface direct dependencies (and MCP deps view when available from the manifest) plus policy preflight on those directs; install MUST NOT run the full dependency resolver/download path solely for dry-run unless a documented opt-in exists (P6a default: no full resolver). Read-only cache or temp outside the project MAY occur only if documented; project tree (manifest, lock, modules, `.cursor` / harness) MUST remain bit-identical before/after dry-run. Targets MUST NOT be invoked for write-side effects on this path (skip ports; optional core-boundary no-op wrappers only — never target-local dry-run knowledge).

#### Scenario: Dry-run leaves project tree unchanged

- **WHEN** install runs with dry-run on a project that has a manifest and lock
- **THEN** the command MUST exit successfully with a preview and MUST leave manifest, lock, modules, and harness paths byte-identical (atime ignored)

#### Scenario: Dry-run skips materialize and MCP configure

- **WHEN** dry-run install would otherwise activate cursor with deployable primitives and MCP
- **THEN** install MUST NOT call write-side `materialize` or `configureMcp` (or equivalent durable harness/MCP writes)

#### Scenario: Dry-run preview uses direct deps without full resolve

- **WHEN** dry-run install runs without an explicit richer-preview opt-in
- **THEN** preview and policy preflight MUST be based on direct dependencies (APM-align) and MUST NOT require a full resolve/download into modules

### Requirement: Positional non-zip package refs add then install

Install MUST accept one or more positional package references that are not pack `.zip` archives. For each such ref, when not dry-run and not frozen, install MUST validate the ref, add it to `dependencies.apm` by default (dual-read brand), or to `devDependencies.apm` when the dev flag is set, and continue with normal install orchestration. A positional argument that matches a marketplace ref `NAME@MARKETPLACE[#ref]` MUST be handled per the positional marketplace pre-resolve requirement (not as a bare git/path package-ref). A positional argument whose path ends with `.zip` (or is otherwise classified as a pack archive) MUST keep existing archive-extract semantics and MUST NOT be treated as a package-ref add. Ambiguous or invalid refs MUST fail closed with a clear error before claiming success.

#### Scenario: Package ref adds to dependencies.apm

- **WHEN** non-frozen install is invoked with a valid positional package ref, no `.zip` archive classification, not a marketplace ref, and without the dev flag
- **THEN** the project manifest MUST gain that ref under `dependencies.apm` and install MUST proceed for the updated manifest

#### Scenario: Zip path stays archive install

- **WHEN** install is invoked with a positional path to a pack-produced `.zip`
- **THEN** install MUST apply archive-consume semantics and MUST NOT treat the path as a dependencies.apm package-ref add

#### Scenario: Package ref with --dev adds to devDependencies.apm

- **WHEN** non-frozen install is invoked with `--dev` and a valid positional package ref
- **THEN** the project manifest MUST gain that ref under `devDependencies.apm`

### Requirement: Positional marketplace refs pre-resolve

Install MUST recognize positional arguments matching marketplace refs `NAME@MARKETPLACE[#ref]` (same parser as marketplace-plugin-resolve). For each such positional, when not dry-run and not frozen, install MUST pre-resolve via marketplace plugin resolve before treating the argument as a generic package-ref, add an appropriate dependency declaration (marketplace string or equivalent object form) to the manifest brand path used by positional add, and continue normal install orchestration so the package is materialized under the modules directory like other installs. Invalid marketplace refs, missing marketplaces/plugins, fetch failures, and unsupported plugin sources MUST fail closed with clear errors before claiming success. Non-marketplace positionals MUST keep existing package-ref / zip behavior.

#### Scenario: Positional NAME@MARKETPLACE installs

- **WHEN** non-frozen install is invoked with positional `demo@local-mp` against a registered local marketplace containing `demo`
- **THEN** install MUST succeed (exit 0), modules MUST contain the installed package, and the lock MUST include marketplace provenance for that entry

#### Scenario: Positional marketplace miss fails

- **WHEN** install is invoked with positional `missing@no-such-market`
- **THEN** install MUST fail non-zero with a clear marketplace/plugin error and MUST NOT mutate as a successful bare-git add of that token

### Requirement: Lock write includes marketplace provenance

When a resolved dependency originated from marketplace resolve, non-frozen lock write-back MUST set on that dependency entry at least `discovered_via` (marketplace alias) and `marketplace_plugin_name`. When the marketplace/plugin metadata provides them, the entry MUST also set `source_url` and/or `source_digest`. The lock entry MUST retain concrete resolved coordinates (git/local/registry fields as applicable) while attaching these provenance keys — matching APM intent. Provenance fields MUST round-trip through lockfile load/serialize.

#### Scenario: Install lock records discovered_via and plugin name

- **WHEN** a successful non-frozen install materializes a marketplace-origin dependency
- **THEN** the written lock dependency MUST include `discovered_via` equal to the marketplace alias and `marketplace_plugin_name` equal to the plugin name

#### Scenario: Optional source_url and source_digest when present

- **WHEN** the fetched marketplace metadata includes source URL and/or digest fields for that resolution
- **THEN** the lock entry MUST also include `source_url` and/or `source_digest` accordingly

### Requirement: Auto-create minimal manifest for positional add

When positional package-ref add is requested and no dual-read project manifest (`apm.yml` / `bapm.yml`) exists, install MUST auto-create a minimal valid manifest (APM parity) before adding the package refs, unless dry-run (preview only) or frozen (reject). When neither positional packages nor an existing manifest is present, install MUST keep existing fail-closed / discover behavior (MUST NOT invent an empty project solely for bare `install`).

#### Scenario: Missing manifest with positional creates then adds

- **WHEN** non-frozen install runs with a positional package ref and no project manifest file
- **THEN** install MUST create a minimal dual-read manifest, add the ref, and continue install

#### Scenario: Bare install without manifest unchanged

- **WHEN** install runs with no positional package refs and no discoverable manifest
- **THEN** install MUST NOT auto-create a manifest solely to succeed

### Requirement: Frozen rejects positional package-ref mutation

When effective frozen mode is active (explicit or CI-default), install MUST reject positional package-ref add that would mutate the manifest, with a non-zero result and no durable writes. Dry-run combined with positional package refs MUST preview the would-add set without writing the manifest or performing other durable project writes, even when frozen would otherwise reject mutation on a non-dry-run path (preview-only escape consistent with APM dry-run positional).

#### Scenario: Frozen plus positional rejected

- **WHEN** effective frozen install is invoked with a positional non-zip package ref and without dry-run
- **THEN** the invocation MUST be rejected without mutating the manifest, lock, modules, or harness

#### Scenario: Dry-run positional previews without write

- **WHEN** install runs with dry-run and a positional package ref
- **THEN** output MUST indicate the package would be added and the manifest MUST remain unchanged

### Requirement: Install exclude skips cursor MCP configure

Install options MUST accept an exclude set of target/runtime ids (CLI `--exclude`). For the cursor-only product surface, excluding `cursor` MUST skip `configureMcp` / `.cursor/mcp.json` writes for that install while package modules/lock and non-MCP materialize MAY still proceed (warn + continue, APM-like). Unknown exclude ids MUST fail closed with a clear usage error. Exclude MUST NOT mean “skip entire install.”

#### Scenario: Exclude cursor skips MCP json write

- **WHEN** install would deploy Cursor MCP and is invoked with exclude including `cursor`
- **THEN** install MUST NOT write or update `.cursor/mcp.json` via configureMcp and MAY still place modules/skills

#### Scenario: Unknown exclude id rejected

- **WHEN** install is invoked with an exclude id that is not a recognized runtime/target for this surface
- **THEN** install MUST fail closed with a clear error and MUST NOT mutate the project

### Requirement: Parallel downloads and verbose on install options

Install public options MUST accept `parallelDownloads` (default aligned with APM default 4; `0` means serial/no parallelism) and a verbose flag that enables richer progress/diagnostics without changing success/failure semantics of frozen or policy gates.

#### Scenario: Parallel downloads option honored

- **WHEN** non-dry-run install runs with `parallelDownloads` set to a non-default non-negative integer
- **THEN** download concurrency MUST follow that value (`0` = serial)

#### Scenario: Verbose does not weaken frozen

- **WHEN** frozen install runs with verbose enabled and a pin/hash failure would occur
- **THEN** install MUST still fail closed identically to non-verbose frozen

### Requirement: Dual-consent gate for direct HTTP dependencies

Install MUST treat a direct APM dependency whose resolved fetch URL uses the `http://` scheme as insecure. Such a dependency MUST be allowed only when **both** (a) the manifest object entry for that dependency sets `allow_insecure: true` and (b) the install invocation sets the allow-insecure flag (`--allow-insecure` / core equivalent). If either consent is missing, install MUST fail closed before download/materialize with an error that names the URL and the missing step(s) (manifest `allow_insecure` and/or CLI flag), APM-shaped. HTTPS and non-HTTP transports MUST NOT require this gate solely due to scheme.

#### Scenario: HTTP direct blocked without CLI flag

- **WHEN** install resolves a direct `http://` dependency with `allow_insecure: true` in the manifest but without the allow-insecure invocation flag
- **THEN** install MUST fail closed with remediation that asks to pass `--allow-insecure` and MUST NOT download that dep

#### Scenario: HTTP direct blocked without manifest allow

- **WHEN** install resolves a direct `http://` dependency without `allow_insecure: true` on the entry, with or without the CLI flag
- **THEN** install MUST fail closed citing the missing manifest `allow_insecure: true` step (and the CLI flag only when it is also missing)

#### Scenario: Dual consent allows HTTP direct

- **WHEN** a direct `http://` dependency has `allow_insecure: true` and install runs with `--allow-insecure`
- **THEN** the dual-consent gate MUST NOT block that dependency solely for being HTTP

### Requirement: Transitive HTTP host allowlist

Install MUST block transitive `http://` dependencies whose hostname is not on an allowlist built from repeatable `--allow-insecure-host` values plus, when `--allow-insecure` is set, hostnames of approved **direct** insecure dependencies. Blocked hosts MUST produce a fail-closed error that suggests `--allow-insecure-host <hostname>` for each blocked host. Invalid hostname tokens passed to `--allow-insecure-host` MUST fail closed at parse/validation (bare FQDN expected).

#### Scenario: Transitive HTTP without host allow fails

- **WHEN** install would fetch a transitive `http://` dependency whose host is not allowlisted
- **THEN** install MUST fail closed naming the unapproved host(s) and MUST NOT complete that fetch path

#### Scenario: Allow-insecure-host permits transitive HTTP

- **WHEN** install runs with `--allow-insecure-host` covering the transitive HTTP hostname (or the host is contributed by an approved direct under `--allow-insecure`)
- **THEN** the transitive host gate MUST NOT block solely for that host

### Requirement: Install only-mode skips APM or MCP sides

Install public options MUST accept an only-mode of `apm` or `mcp` (CLI `--only`). When `apm`, install MUST run the APM package resolve/download/materialize path and MUST skip MCP configure / `.cursor/mcp.json` writes for that invocation. When `mcp`, install MUST run the MCP configure path (subject to existing trust/exclude/detect rules) and MUST skip APM package download/materialize into the project modules tree for that invocation; lock MCP restoration semantics already present MUST be preserved where applicable. Values other than `apm` or `mcp` MUST be rejected fail-closed. Only-mode MUST NOT weaken frozen or policy gates on the work that still runs.

#### Scenario: only apm skips MCP configure

- **WHEN** install would otherwise configure Cursor MCP and is invoked with only-mode `apm`
- **THEN** `.cursor/mcp.json` MUST remain unchanged by configureMcp on that run and APM package work MAY still proceed

#### Scenario: only mcp skips APM materialize

- **WHEN** install is invoked with only-mode `mcp` on a project that would otherwise download/materialize APM packages
- **THEN** install MUST NOT materialize APM package trees into the project modules directory for that invocation and MAY still configure MCP

### Requirement: Force flag does not bypass frozen or policy

Install public options MUST accept a force flag (`--force`). Force MUST NOT re-resolve/refresh mutable refs by itself, MUST NOT bypass effective frozen gates, and MUST NOT disable policy discovery/evaluation. Cursor project materialize MAY continue to overwrite destination files when content differs (collision protective-skip is out of this change); force remains accepted for CLI parity and any future thin security-gate bypass without inventing a full scanner in this slice. Force MUST remain distinct from forced-target activation (`--target` / `forcedTarget`).

#### Scenario: Force accepted without weakening frozen

- **WHEN** effective frozen install is invoked with `--force` and a pin or hash integrity failure would occur
- **THEN** install MUST still fail closed identically to frozen without force

#### Scenario: Force does not disable policy

- **WHEN** install runs with `--force` against a blocking deny policy and without `--no-policy`
- **THEN** the policy gate MUST still fail closed before durable installs writes that policy would block

### Requirement: Dev positional adds to devDependencies

When positional package-ref add runs with the dev flag (`--dev`), install MUST write validated refs under `devDependencies.apm` (creating the `devDependencies` / `apm` block if needed), not under `dependencies.apm`. Without positional package refs, `--dev` MUST NOT invent durable side effects (no-op or warn only). Dry-run + `--dev` + positional MUST preview would-add under `devDependencies.apm` without write. Frozen×positional reject rules MUST still apply.

#### Scenario: Positional with --dev writes devDependencies.apm

- **WHEN** non-frozen install is invoked with `--dev` and a valid positional package ref
- **THEN** the manifest MUST gain that ref under `devDependencies.apm` and MUST NOT place it under `dependencies.apm` solely due to that add

#### Scenario: --dev without positional is non-mutating

- **WHEN** install is invoked with `--dev` and no positional package refs
- **THEN** install MUST NOT mutate the manifest solely because `--dev` was set

### Requirement: Dual-write deployed_files lists with hashes

When install records `deployed_file_hashes` for a dependency (or `local_deployed_file_hashes` at document level) during lock write-back after materialize, install MUST also keep the parallel `deployed_files` / `local_deployed_files` string lists in sync with the hash-map keys for those same paths (union so list membership includes hash keys written in that pass). Find MUST remain correct when only hash maps exist on older locks; dual-write is for APM-shaped inventory parity and list consumers. Dual-write MUST NOT change the hash algorithm or orphan-cleanup keying off hash maps.

#### Scenario: Hash write also updates list field

- **WHEN** a non-frozen install writes `deployed_file_hashes` for dependency paths after materialize
- **THEN** the same lock dependency entry MUST include `deployed_files` listing those path keys

#### Scenario: Local hashes dual-write local list

- **WHEN** install writes document-level `local_deployed_file_hashes`
- **THEN** the lock document MUST include `local_deployed_files` listing those path keys

### Requirement: Install selects only an unambiguous registered target

For install materialization and MCP configuration, core MUST evaluate target detection through the registered integration registry. When exactly one registered integration is detected, install MUST select that target automatically. When zero or more than one registered integrations are detected, install MUST require an explicit registered target id and MUST fail before target harness writes if none is supplied. An explicit registered target MUST override automatic detection; an unknown id MUST fail closed.

#### Scenario: Sole detected target deploys automatically

- **WHEN** install runs without an explicit target and exactly one registered integration positively detects the project
- **THEN** install MUST invoke that integration's eligible materialize and MCP capabilities

#### Scenario: No target detection requires explicit target

- **WHEN** install runs without an explicit target and no registered integrations positively detect the project
- **THEN** install MUST fail with guidance to pass `--target <id>` and MUST NOT write target harness files

#### Scenario: Ambiguous target detection requires explicit target

- **WHEN** install runs without an explicit target and two or more registered integrations positively detect the project
- **THEN** install MUST fail with guidance to pass `--target <id>` and MUST NOT write target harness files

### Requirement: Exclude validation derives from registered targets

Install MUST validate each `--exclude` target/runtime id against the registered integration registry rather than a concrete Cursor allowlist. A registered id is valid even when it is not the selected active target; an unregistered id MUST fail closed before target configuration writes. Exclusion MUST continue to suppress only the excluded target's eligible runtime configuration, not the entire install.

#### Scenario: Registered non-Cursor exclude is accepted

- **WHEN** install receives an exclude id for a registered non-Cursor integration
- **THEN** validation MUST accept the id without core containing host-specific allowlist knowledge

#### Scenario: Unregistered exclude is rejected

- **WHEN** install receives an exclude id absent from the integration registry
- **THEN** install MUST fail with a clear error before target configuration writes

### Requirement: Core attributes deployment only from target reports

Core MUST build deployed-file and MCP configuration inventory from paths, hashes, and ownership reported by selected registered target capabilities. Core MUST NOT synthesize a concrete target path, filename, target id, or primitive-to-layout attribution as a fallback. Missing required deployment reporting from a selected capability MUST fail closed rather than record an invented concrete-host inventory.

#### Scenario: Target report drives deployed-file lock attribution

- **WHEN** a selected target materializes primitives and reports deployment entries
- **THEN** lock deployment inventory MUST be attributed from that report without Cursor-specific path derivation in core

#### Scenario: Missing required report does not use Cursor fallback

- **WHEN** a selected target writes or claims to write deploy output but omits required deployment attribution
- **THEN** install MUST fail clearly or omit only the unsupported operation according to the capability contract, and MUST NOT infer a Cursor path or inventory entry
