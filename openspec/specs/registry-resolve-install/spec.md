# registry-resolve-install Specification

## Purpose

Closes M3 `RESOLVE_REGISTRY_DEFERRED` by resolving and installing registry-sourced dependencies: semver pick from the registry version list, SHA-256 verify before extract (lk-013), mirror-by-hash replay (rs-009), and lock populate with `resolved_url` / `resolved_hash`—without silent git fallback.

## Requirements

### Requirement: Resolve registry deps via registries block

For dependencies classified as `registry`, resolve MUST use the project manifest `registries:` block (already validated in M1). A per-dep registry name MUST route to that named base URL; when omitted, resolve MUST use `registries.default`. Missing registry configuration for a registry dep MUST fail closed.

#### Scenario: registries.default used when registry name omitted

- **WHEN** a registry dep has no per-dep registry name and `registries.default` names a declared registry
- **THEN** resolve MUST fetch from that default registry base URL

#### Scenario: Named registry routes correctly

- **WHEN** a registry dep sets `registry: <name>` for a declared registry
- **THEN** resolve MUST use that registry's base URL and MUST NOT use another registry's URL

### Requirement: Semver or exact version selection from version list

Resolve MUST list versions from the registry client and select a satisfying version (exact pin or highest satisfying semver range in the APM `pick_best` spirit). Empty intersection / no matching version MUST fail closed.

#### Scenario: Highest satisfying version selected

- **WHEN** the version list includes `1.0.0` and `1.1.0` and the constraint is `^1.0.0`
- **THEN** resolve MUST select `1.1.0` (or the documented highest satisfying)

#### Scenario: No matching version fails

- **WHEN** no listed version satisfies the constraint
- **THEN** resolve MUST fail closed and MUST NOT fall back to git

### Requirement: Verify digest before extract (lk-013)

After download, the system MUST compute SHA-256 of the archive bytes and MUST compare to the advertised digest (and/or lock `resolved_hash` on replay) **before** extracting into the modules cache. On mismatch, resolve/install MUST exit non-zero, MUST NOT leave a partial extract as a successful package tree, and MUST leave modules unchanged relative to a failed registry materialize.

#### Scenario: Digest mismatch fails before extract

- **WHEN** advertised digest does not match archive bytes
- **THEN** the operation MUST fail closed before extract and modules MUST remain unchanged for that package

#### Scenario: Matching digest allows extract

- **WHEN** archive SHA-256 matches the advertised `sha256:<hex>` digest
- **THEN** extract/materialize into modules cache MAY proceed

### Requirement: Lock records resolved_url and resolved_hash

Successful registry resolve MUST write lock entries with `source: registry`, `resolved_url`, and `resolved_hash` in `sha256:<hex>` envelope form (and other required registry shape fields per lockfile-yaml-rw). `lockfile_version` MUST be `"2"` when any registry entry is present.

#### Scenario: Lock gains registry fields

- **WHEN** resolve/install succeeds for a registry dep against a mock registry
- **THEN** the lock entry MUST include `resolved_url` and `resolved_hash` matching the verified bytes

### Requirement: Mirror fetch allowed when hash matches (rs-009)

On lock replay / install, the system MAY fetch archive bytes from a URL different from the recorded `resolved_url` (mirror) **iff** the downloaded bytes hash to the lock `resolved_hash`. Hash mismatch MUST fail closed. Silent substitution without hash verify MUST NOT occur.

#### Scenario: Mirror URL with matching hash succeeds

- **WHEN** lock has `resolved_url` A and `resolved_hash` H, and fetch from mirror B yields bytes hashing to H
- **THEN** install/materialize MUST succeed

#### Scenario: Mirror URL with wrong hash fails

- **WHEN** fetch from a mirror yields bytes that do not match `resolved_hash`
- **THEN** install MUST fail closed before treating extract as success

### Requirement: No silent git fallback for registry deps

Registry-sourced dependencies MUST NOT be cloned or resolved as git when the registry is unreachable, returns errors, or is misconfigured. Failure MUST be a hard error naming registry fetch.

#### Scenario: Unreachable registry does not clone git

- **WHEN** a registry dep cannot be listed or downloaded due to transport/registry failure
- **THEN** resolve/install MUST fail hard and MUST NOT attempt git clone as a substitute

### Requirement: Marketplace remains deferred fail-closed

Dependencies classified as marketplace (non-normative) MUST continue to fail closed / deferred in M10 and MUST NOT install silently via the registry client.

#### Scenario: Marketplace kind does not install via registry client

- **WHEN** resolve encounters a marketplace-kind dependency
- **THEN** it MUST fail closed with a deferred/unsupported diagnostic and MUST NOT treat it as a successful registry install

### Requirement: Registry materialize applies shared safe-extract after digest verify

After SHA-256 digest verification succeeds (lk-013), registry archive materialize into the modules cache MUST apply the shared archive-safe-extract policy: reject `..` / absolute / symlink (and hardlink / non-regular where exposed), enforce default 10 000 entry and 100 MB uncompressed caps, and fail-closed cleanup of partial destination on extract failure. Digest mismatch MUST still fail **before** extract with modules unchanged. Safe-extract MUST NOT skip or weaken digest verify.

#### Scenario: Symlink in registry zip fails after matching digest

- **WHEN** registry bytes hash to the expected digest but the zip contains a symlink member
- **THEN** materialize MUST fail closed after digest verify and MUST NOT leave a successful package tree for that dest

#### Scenario: Caps exceeded on registry zip fails

- **WHEN** a digest-matching registry zip exceeds the default entry or uncompressed size cap
- **THEN** materialize MUST fail closed and MUST NOT treat the package as successfully extracted

#### Scenario: Digest mismatch still skips extract

- **WHEN** advertised digest does not match archive bytes
- **THEN** materialize MUST fail closed before extract and MUST NOT invoke safe-extract writes for that package
