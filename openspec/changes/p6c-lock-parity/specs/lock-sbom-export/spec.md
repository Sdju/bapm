## Purpose

Defines read-only SBOM inventory export from an existing lockfile document in `@bapm/core`: CycloneDX 1.5 (default) and SPDX 2.3 JSON built only from recorded lock fields—no resolve, network, re-hash, or filesystem mutation of the project.

## ADDED Requirements

### Requirement: Export SBOM from lockfile fields only
The system MUST produce an SBOM inventory document from a loaded lockfile (or equivalent in-memory document) using only fields already recorded in that lock. Export MUST NOT call resolve/download, MUST NOT perform network I/O, MUST NOT re-hash package trees, MUST NOT run policy gates, MUST NOT materialize targets, and MUST NOT mutate the lockfile, `apm_modules/`, or harness directories. Synthetic `<self>` / local-self entries MUST be omitted from components when they are not real dependency inventory.

#### Scenario: Export does not rewrite lock or modules
- **WHEN** SBOM export runs successfully against an existing lockfile
- **THEN** the lockfile content and project modules/harness trees MUST remain unchanged by the export operation

#### Scenario: Export does not resolve or download
- **WHEN** SBOM export runs with network disabled or without a downloader wired
- **THEN** export MUST still succeed when the lockfile is present and parseable

### Requirement: CycloneDX 1.5 default and SPDX 2.3 supported
Export MUST support format identifiers `cyclonedx` (default) and `spdx`. CycloneDX output MUST declare spec version `1.5`. SPDX output MUST declare SPDX version `SPDX-2.3` (or equivalent SPDX-2.3 JSON document version field). Unknown format identifiers MUST fail closed with a diagnostic. Tool/creator metadata MAY identify `bapm` (byte-identity with APM goldens is NOT required).

#### Scenario: Default format is CycloneDX
- **WHEN** export is invoked without an explicit format
- **THEN** the emitted document MUST be CycloneDX JSON at spec version 1.5

#### Scenario: SPDX format selected
- **WHEN** export is invoked with format `spdx`
- **THEN** the emitted document MUST be SPDX 2.3 JSON

#### Scenario: Unknown format rejected
- **WHEN** export is invoked with an unrecognized format string
- **THEN** the operation MUST fail closed and MUST NOT emit a partial SBOM body as success output

### Requirement: Deterministic component order and stable JSON
Components MUST be sorted by package URL (`purl`). Serialized JSON MUST be stable for identical inputs: consistent indentation and sorted object keys (or an equivalent documented stable encoding). Two exports of the same lock with the same pinned timestamp MUST be byte-identical.

#### Scenario: Same lock and timestamp yields identical bytes
- **WHEN** the same lockfile is exported twice with the same pinned timestamp and format
- **THEN** the two SBOM byte sequences MUST be identical

### Requirement: Timestamp resolution order
The SBOM document timestamp MUST resolve in this order: explicit caller-supplied timestamp when provided; else `SOURCE_DATE_EPOCH` when set; else lockfile `generated_at` when present; else a fixed epoch fallback. Export MUST NOT invent a wall-clock timestamp when a higher-priority pin is available.

#### Scenario: Explicit timestamp wins
- **WHEN** an explicit timestamp is supplied to export
- **THEN** the SBOM timestamp fields MUST use that value regardless of `SOURCE_DATE_EPOCH` and lock `generated_at`

#### Scenario: SOURCE_DATE_EPOCH used when no explicit timestamp
- **WHEN** no explicit timestamp is supplied and `SOURCE_DATE_EPOCH` is set
- **THEN** the SBOM timestamp MUST derive from that epoch value

### Requirement: purl identity from lock fields with URL scrubbing
Each dependency component MUST receive a `purl` derived only from lock-recorded identity fields, aligned with APM inventory rules: git forge hosts map to `pkg:github|gitlab|bitbucket/...@commit` when applicable, otherwise `pkg:generic/...@commit`; OCI → `pkg:oci/...@digest`; local/generic → `pkg:generic/...` with optional content hash when recorded. Any URL emitted in the SBOM (for example distribution references) MUST scrub credentials (drop userinfo and query) when cheap.

#### Scenario: Git hub-style repo gets forge purl
- **WHEN** a lock dependency has a github.com-style `repo_url` and `resolved_commit`
- **THEN** its component `purl` MUST use the github forge form with that commit

#### Scenario: Scrubbed distribution URL
- **WHEN** a dependency records a `resolved_url` containing userinfo or query credentials
- **THEN** any SBOM URL reference for that distribution MUST omit userinfo and query

### Requirement: Declared license passthrough three-state
When `declared_license` is present on a dependency, export MUST pass it through into the SBOM license fields per format rules (CycloneDX license id/expression/name; SPDX declared text). When undeclared, CycloneDX MUST omit the licenses array and SPDX MUST use `NOASSERTION`. Export MUST NOT nag or block on license authoring.

#### Scenario: Undeclared license omitted in CycloneDX
- **WHEN** a dependency has no `declared_license` and format is CycloneDX
- **THEN** that component MUST NOT include a licenses array

#### Scenario: Undeclared license is NOASSERTION in SPDX
- **WHEN** a dependency has no `declared_license` and format is SPDX
- **THEN** that package's declared license field MUST be `NOASSERTION`

### Requirement: Missing lock fails closed for consumers
Callers that export from project discovery MUST treat a missing lockfile as failure: non-success result, explanatory diagnostic, and no successful SBOM body for the missing-lock case. (CLI IO purity for stdout/stderr is specified under `lock-command`.)

#### Scenario: Missing lock returns failure
- **WHEN** export is requested for a project directory with no discoverable lockfile
- **THEN** the export operation MUST fail and MUST NOT claim a successful SBOM document
