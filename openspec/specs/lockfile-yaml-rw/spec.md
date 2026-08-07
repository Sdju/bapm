# lockfile-yaml-rw Specification

## Purpose

Parses, validates, and serializes OpenAPM/APM lockfile YAML in `@bapm/core` for M2: required container fields, dependency entry shapes, monotonic version policy, sort and semantic equivalence, hash envelopes, unknown/`x-*` round-trip—without resolve, download, install, or target deploy.

## Requirements

### Requirement: Top-level document must be a mapping with version and dependencies

The system MUST reject a YAML document whose root is not a mapping. On validate, the document MUST provide `dependencies` as a list. The system MUST accept `lockfile_version` values `"1"` and `"2"` only. When `lockfile_version` is absent on read, the system MUST default it to `"1"`. On every successful serialize/write, the system MUST emit an explicit `lockfile_version` string. Invalid YAML MUST fail with a diagnostic that identifies the source (OpenAPM req-lk-001, req-lk-004; APM legacy default).

#### Scenario: Minimal valid empty lock

- **WHEN** a YAML mapping with `lockfile_version: "1"` and `dependencies: []` is parsed
- **THEN** the system MUST accept it with version `"1"` and an empty dependency list

#### Scenario: Absent lockfile_version defaults to 1 on read

- **WHEN** a mapping provides `dependencies: []` and omits `lockfile_version`
- **THEN** the system MUST accept the document and treat `lockfile_version` as `"1"`

#### Scenario: Serialize always emits lockfile_version

- **WHEN** a lockfile model (including one loaded without an on-disk version) is serialized
- **THEN** the emitted YAML MUST include an explicit `lockfile_version` string

#### Scenario: Non-mapping root rejected

- **WHEN** a YAML document whose root is a list or scalar is parsed
- **THEN** the system MUST reject it with a format diagnostic

#### Scenario: Missing dependencies rejected

- **WHEN** a mapping lacks a `dependencies` list
- **THEN** the system MUST reject it (req-lk-001)

#### Scenario: Unsupported lockfile_version rejected

- **WHEN** `lockfile_version` is `"3"` or another unrecognized value
- **THEN** the system MUST reject it with a diagnostic that mentions upgrade or regenerate (req-lk-004)

### Requirement: YAML safe subset for lockfile documents

The system MUST reject YAML anchors, aliases, and custom tags when loading lockfile YAML, consistent with the M1 safe-subset policy.

#### Scenario: Anchor and alias rejected

- **WHEN** lockfile YAML uses an anchor and alias reference
- **THEN** the system MUST reject the document

### Requirement: Git and registry entry shape validation

For dependency entries claiming git identity, the system MUST require `repo_url` and `resolved_commit`. For entries with `source: registry`, the system MUST require `repo_url`, `resolved_url`, and `resolved_hash`. Shape validation MUST NOT perform network fetch or archive verification (req-lk-003 shape half).

#### Scenario: Git entry with repo_url and resolved_commit accepted

- **WHEN** a dependency entry provides `repo_url` and a 40-hex `resolved_commit`
- **THEN** the system MUST accept the entry shape

#### Scenario: Registry entry with required fields accepted

- **WHEN** an entry has `source: registry`, `repo_url`, `resolved_url`, and `resolved_hash`
- **THEN** the system MUST accept the entry shape

#### Scenario: Registry entry missing resolved_hash rejected

- **WHEN** an entry has `source: registry` without `resolved_hash`
- **THEN** the system MUST reject the document (req-lk-003)

### Requirement: Monotonic lockfile_version on emit

When any dependency has `source: registry`, emit MUST use `lockfile_version: "2"`. When a lockfile was loaded or set as `"2"`, serialize MUST NOT demote to `"1"` even if registry or git-semver fields are later absent (OpenAPM req-lk-002 monotonic; stricter than APM demotion). The system MAY emit `"2"` for git-semver fields without registry (APM-compatible bump) without violating OpenAPM.

#### Scenario: Registry forces version 2

- **WHEN** dependencies include any `source: registry` entry and the lockfile is serialized
- **THEN** emitted `lockfile_version` MUST be `"2"`

#### Scenario: Loaded v2 remains v2 without registry

- **WHEN** a lockfile loaded as `"2"` is rewritten after all registry entries are removed
- **THEN** emitted `lockfile_version` MUST still be `"2"`

### Requirement: Dependency sort and semantic equivalence

On serialize, dependency entries MUST be ordered lexicographically by `(repo_url, virtual_path)` using identity `repo_url`, not `materialization_repo_url` display spelling (req-lk-005, req-lk-022 sort). Semantic equivalence comparison MUST ignore `generated_at` and `apm_version` (req-lk-005).

#### Scenario: Sort by repo_url and virtual_path

- **WHEN** a lockfile with unordered dependencies (including materialization display variants) is serialized
- **THEN** emitted `dependencies` MUST be sorted by `(repo_url, virtual_path)` and MUST NOT order primarily by `materialization_repo_url` or APM `(depth, repo_url)`

#### Scenario: Semantic equivalence ignores metadata timestamps

- **WHEN** two lockfiles differ only in `generated_at` and/or `apm_version`
- **THEN** semantic equivalence MUST report them equivalent

### Requirement: Omit unset fields and preserve unknowns on round-trip

Serialize MUST omit unset/empty optional fields and MUST NOT emit `null` placeholders for absent keys (req-lk-011). Unknown fields at top-level and per-entry, including APM-only blocks such as `deployments` and `lsp_*` when not first-class modeled, MUST be preserved on load→serialize round-trip. Top-level and per-entry `x-*` keys MUST be preserved (req-lk-014).

#### Scenario: Round-trip unknown and x-* fields

- **WHEN** a lockfile containing unknown future fields and `x-*` extensions is loaded and serialized
- **THEN** those fields MUST appear in the emitted YAML

#### Scenario: Omit unset dependency fields

- **WHEN** a dependency model has only required identity fields set
- **THEN** serialize MUST NOT emit null keys for absent optional fields

#### Scenario: Preserve deployments and lsp blocks as unknown

- **WHEN** a lockfile includes top-level `deployments` or `lsp_*` structures not modeled as first-class M2 types
- **THEN** load→serialize MUST preserve them

### Requirement: Hash envelope normalize

On read, a bare 64-hex hash MUST be treated as `sha256:<hex>`. On write, hash fields the system emits MUST use `<algo>:<hex>` envelope form (req-lk-016). Accepting envelope form on read MUST succeed. Archive/download verification of `resolved_hash` for registry fetches is performed by the registry resolve/install path (lk-013 / rs-009); lockfile load/serialize alone MUST still NOT network-fetch or extract archives.

#### Scenario: Bare hex normalized on read

- **WHEN** a hash field contains a bare 64-character hex string
- **THEN** the in-memory model MUST treat it as `sha256:<hex>`

#### Scenario: Envelope form emitted on write

- **WHEN** a lockfile with normalized hashes is serialized
- **THEN** emitted hash fields MUST use `<algo>:<hex>` form

#### Scenario: Shape validation still no network

- **WHEN** a lockfile with `source: registry` and `resolved_hash` is loaded for shape validation only
- **THEN** load/serialize MUST NOT perform network fetch or archive extract

### Requirement: Inventory name and version are not identity

Dependency `name` and dep-manifest-derived `version` MUST be preserved on round-trip and MUST NOT be used as the unique identity key for the entry (req-lk-019).

#### Scenario: Inventory metadata round-trip

- **WHEN** an entry includes `name` and git `version` inventory fields
- **THEN** load→serialize MUST preserve them and identity/unique-key helpers MUST ignore them

### Requirement: materialization_repo_url identity check

If `materialization_repo_url` is present, it MUST normalize to the same identity as `repo_url`; otherwise parse/validate MUST fail closed. `materialization_repo_url` MUST NOT be treated as the identity key (req-lk-022 validate half). Full filesystem materialization/migration is out of M2.

#### Scenario: materialization_repo_url mismatch rejected

- **WHEN** `materialization_repo_url` normalizes to a different identity than `repo_url`
- **THEN** the system MUST reject the document

#### Scenario: Matching materialization_repo_url accepted

- **WHEN** `materialization_repo_url` normalizes to the same identity as `repo_url`
- **THEN** the system MUST accept the entry

### Requirement: Self-entry not written into dependencies

When top-level `local_deployed_files` / `local_deployed_file_hashes` are present, the system MAY synthesize an in-memory self entry, but serialize MUST NOT write that self entry into the `dependencies` list; flat top-level fields MUST remain (APM/OpenAPM §5.3).

#### Scenario: Self fields round-trip outside dependencies

- **WHEN** a lockfile with top-level `local_deployed_files` is loaded and serialized
- **THEN** those flat fields MUST remain at top level and MUST NOT appear as a `dependencies` list item keyed as self

### Requirement: Accept deferred runtime field shapes without executing them

The system MUST accept and emit shapes for `constraint` / `resolved_tag` / `resolved_at` / `resolved_ref` (req-lk-008 and APM pin identity), `deployed_file_hashes` / `local_deployed_file_hashes` (req-lk-012), `resolved_hash` (req-lk-013), and `tree_sha256` (req-lk-015) when present. M2 MUST NOT resolve semver, compute hashes from disk, verify archives, or recompute tree hashes. When `resolved_ref` is present on load, serialize MUST preserve it (including when the entry was produced by APM or an older bapm lock that already carried the field).

#### Scenario: Deferred fields preserved without runtime verify

- **WHEN** a lockfile includes those deferred fields with valid envelope/string shapes
- **THEN** parse and serialize MUST succeed without performing resolve, download, or hash recompute

#### Scenario: resolved_ref round-trips on load serialize

- **WHEN** a dependency entry includes `resolved_ref: release` alongside `resolved_commit`
- **THEN** load→serialize MUST emit `resolved_ref` with the same string value

### Requirement: M2 does not resolve download install or touch targets

Successful lockfile parse/serialize/discovery MUST NOT download dependencies, run frozen install, materialize targets, or invoke target adapters. Lockfile M2 MUST NOT introduce in-tree target adapters or change `target-package-architecture` obligations.

#### Scenario: Load does not install

- **WHEN** a valid lockfile is loaded successfully
- **THEN** the system MUST NOT create `apm_modules/`, fetch remotes, or deploy to a host target

### Requirement: Populate mcp inventory fields when MCP configs written

When install writes Cursor MCP configuration, lock serialize/write-back MUST populate or update first-class (or already-known optional) top-level MCP inventory fields—`mcp_servers`, `mcp_configs`, `mcp_target_servers`, and/or `mcp_config_provenance` as applicable—so subsequent load→serialize preserves them. Unknown/`x-*` keys MUST still round-trip. Absence of MCP deploy MUST NOT require inventing empty MCP blocks.

#### Scenario: MCP fields present after MCP install write-back

- **WHEN** a lock is written after successful Cursor MCP deploy
- **THEN** emitted YAML MUST include the applicable `mcp_*` inventory covering configured servers

#### Scenario: No MCP leaves mcp blocks optional

- **WHEN** a lock is written for an install without MCP deploy
- **THEN** serialize MUST NOT be required to emit empty `mcp_*` placeholders

### Requirement: MCP configuration inventory preserves target identity

Lockfile load and serialize MUST preserve MCP configuration inventory entries keyed by their existing target identifiers. When install adds or updates an MCP configuration entry for a target, the serialized inventory MUST use that target identifier and the project-relative path reported by its target configure contract. Lockfile serialization MUST NOT rename, remove, or rewrite legacy MCP inventory entries solely because they use an older key or path shape.

#### Scenario: Target-keyed MCP inventory round-trips

- **WHEN** a lock contains MCP configuration inventory for `x-acme-editor` with path `config/mcp.json`
- **THEN** load followed by serialize MUST retain that target id and path

#### Scenario: Legacy MCP inventory remains intact

- **WHEN** a lock contains a legacy Cursor-shaped MCP inventory entry and an unrelated target entry
- **THEN** load followed by serialize MUST retain both entries unchanged

### Requirement: Marketplace provenance fields round-trip

Lockfile load and serialize MUST preserve dependency entry fields `discovered_via`, `marketplace_plugin_name`, `source_url`, and `source_digest` when present. These fields MUST NOT be stripped as unknown solely because they are marketplace provenance. Serialize MUST still omit them when unset/empty (no null placeholders). First-class typed fields on the lock dependency model are preferred but not required if the open index signature already preserves keys on round-trip.

#### Scenario: Provenance keys survive load then serialize

- **WHEN** a lock dependency entry includes `discovered_via`, `marketplace_plugin_name`, and optionally `source_url` / `source_digest`
- **THEN** load→serialize MUST emit the same provenance keys and values

#### Scenario: Absent provenance omitted

- **WHEN** a dependency entry has no marketplace provenance fields set
- **THEN** serialize MUST NOT emit null placeholders for those keys
