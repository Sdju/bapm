## ADDED Requirements

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
Install MUST accept one or more positional package references that are not pack `.zip` archives. For each such ref, when not dry-run and not frozen, install MUST validate the ref, add it to `dependencies.apm` (dual-read brand), and continue with normal install orchestration. A positional argument whose path ends with `.zip` (or is otherwise classified as a pack archive) MUST keep existing archive-extract semantics and MUST NOT be treated as a package-ref add. Ambiguous or invalid refs MUST fail closed with a clear error before claiming success.

#### Scenario: Package ref adds to dependencies.apm
- **WHEN** non-frozen install is invoked with a valid positional package ref and no `.zip` archive classification
- **THEN** the project manifest MUST gain that ref under `dependencies.apm` and install MUST proceed for the updated manifest

#### Scenario: Zip path stays archive install
- **WHEN** install is invoked with a positional path to a pack-produced `.zip`
- **THEN** install MUST apply archive-consume semantics and MUST NOT treat the path as a dependencies.apm package-ref add

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
