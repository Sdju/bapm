## Purpose

Defines the `bapm pack --check-versions` marketplace version-alignment gate, including how local Plugin collections without an OpenAPM manifest supply `version` via `plugin.json`.

## ADDED Requirements

### Requirement: pack --check-versions runs marketplace version alignment

Invoking `pack --check-versions` MUST run a release-time version-alignment gate over **local-path** packages in the project's marketplace authoring config. The gate MUST evaluate `marketplace.versioning.strategy` values `lockstep`, `tag_pattern`, and `per_package` (default `lockstep` when versioning is omitted). The gate MUST NOT create or push git tags, MUST NOT perform network I/O, and MUST remain distinct from `pack --check-release` (pr-004 tag↔project-manifest version).

#### Scenario: Gate-only check-versions without archive

- **WHEN** `runCli(["pack", "--check-versions"])` runs on a project with a valid `marketplace:` block and aligned local packages
- **THEN** the exit code MUST be `0` for a successful gate and the run MUST NOT require `--archive` to succeed

#### Scenario: Distinct from check-release

- **WHEN** pack help or flag parsing documents `--check-versions`
- **THEN** `--check-versions` MUST NOT be aliased to `--check-release` and MUST NOT compare a git tag to the project root manifest version as its primary rule

### Requirement: Skip when no marketplace block

When `--check-versions` is requested and the project has no loadable marketplace authoring config (`marketplace:` / legacy marketplace file absent), the command MUST skip the alignment check with an informational message and MUST exit `0` for the gate portion (nothing to check). A malformed marketplace config that fails to load MUST fail closed with non-zero exit.

#### Scenario: No marketplace skips informatively

- **WHEN** `pack --check-versions` runs in a conforming project without a `marketplace:` block
- **THEN** the run MUST exit `0` for the gate and MUST emit an informational skip mentioning that there is no marketplace block / nothing to check

### Requirement: Local package version source precedence

For each local package under check, the system MUST resolve a declared version with this precedence:

1. If a dual-read OpenAPM manifest (`bapm.yml` or `apm.yml`) exists at the package root, that file is **authoritative**: parse it and read top-level string `version`. A present but invalid, non-file, or missing-version preferred manifest MUST fail closed and MUST NOT fall back to `plugin.json`.
2. Only when neither `bapm.yml` nor `apm.yml` exists at the package root, the system MUST read `version` from a discovered `plugin.json` for that package (standard locations: package-root `plugin.json`, then `.github/plugin/plugin.json`, `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json` — first existing wins).

A usable version MUST be a non-empty string after trim. For `plugin.json` versions, the string MUST be printable ASCII; otherwise fail closed.

#### Scenario: Plugin-only local package uses plugin.json version

- **WHEN** a local marketplace package has root `plugin.json` with `"version": "1.2.3"` and no `bapm.yml`/`apm.yml`
- **THEN** `--check-versions` MUST treat package version as `1.2.3` for strategy evaluation

#### Scenario: Manifest wins over plugin.json

- **WHEN** a local package has both an OpenAPM manifest with `version: 1.2.3` and a `plugin.json` with `"version": "9.9.9"`
- **THEN** `--check-versions` MUST use `1.2.3` and MUST ignore the plugin.json version for alignment

#### Scenario: Invalid preferred manifest does not fall back

- **WHEN** a local package has a present but malformed `apm.yml`/`bapm.yml` and a valid `plugin.json` with a version
- **THEN** `--check-versions` MUST fail closed for that package and MUST NOT use the plugin.json version

### Requirement: Fail closed on missing or invalid plugin.json version

When falling back to `plugin.json`, the gate MUST fail closed (non-zero exit for the gate) if: no plugin.json is found; the file is not a regular file; JSON parse fails; the document is not an object; `version` is missing/empty/non-string; `version` is non-printable or non-ASCII; or the file exceeds a bounded size limit (1 MiB). Error text MUST identify the package path and the failure class (e.g. missing version in plugin.json, malformed JSON).

#### Scenario: Missing plugin.json version fails

- **WHEN** a local package has only `plugin.json` without a usable `version` string
- **THEN** `--check-versions` MUST exit non-zero and the diagnostic MUST mention missing `version` in `plugin.json`

#### Scenario: Malformed plugin.json fails

- **WHEN** a local package's only version source is a malformed `plugin.json`
- **THEN** `--check-versions` MUST exit non-zero and MUST NOT treat the package as aligned

### Requirement: Strategy evaluation for local packages

Given successfully read versions:

- **lockstep**: each local package version MUST equal the marketplace top-level `version` (inherited from project when omitted on the block).
- **tag_pattern**: each local package MUST render a unique tag via `build.tagPattern` / per-entry `tag_pattern` with `{name}` and `{version}` (or equivalent); duplicate rendered tags MUST fail closed.
- **per_package**: each local package MUST only declare a usable version; equality across packages is not required.

Remote (non-local) packages MUST be ignored by this gate. Overall gate failure MUST be non-zero exit; success MUST be exit `0` for the gate portion.

#### Scenario: lockstep drift fails

- **WHEN** strategy is `lockstep`, marketplace version is `1.0.0`, and a local package declares `2.0.0`
- **THEN** `--check-versions` MUST exit non-zero with a diagnostic that the package version does not match the expected marketplace version

#### Scenario: per_package accepts divergent versions

- **WHEN** strategy is `per_package` and two local packages declare different valid versions
- **THEN** `--check-versions` MUST succeed for version presence alone

### Requirement: Gate does not imply durable pack artifacts

Running `--check-versions` alone (without `--archive` and without marketplace emit intent that would otherwise write host JSON) MUST NOT leave a durable zip or host `marketplace.json` solely because the gate ran. Combining with `--archive` / marketplace emit MUST preserve existing emit rules after a successful gate (or fail before emit when the gate fails).

#### Scenario: check-versions dry path leaves no zip

- **WHEN** `pack --check-versions` (optionally with `--dry-run`) succeeds on a marketplace with local packages and `--archive` is not set
- **THEN** no durable pack zip MUST be required as success output for that gate-only run
