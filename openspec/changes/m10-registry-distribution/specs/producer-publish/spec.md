## Purpose

Thin `bapm publish` builds a flat APM-wire registry zip (manifest at archive root as `apm.yml` plus `.apm/` and optional root docs) and uploads via PUT—distinct from M7 plain pack—with dry-run/zip flags and an opt-in experimental gate.

## ADDED Requirements

### Requirement: Publish requires owner/repo and version
Invoking `publish` MUST require a package id in `owner/repo` form and a version from the dual-read project manifest. Missing id or version MUST fail closed before upload. Dual-read discovery MUST accept projects with `apm.yml` **or** `bapm.yml` (not both).

#### Scenario: bapm.yml-only project can publish
- **WHEN** publish runs on a conforming project that has only `bapm.yml`
- **THEN** publish MUST proceed past dual-read discovery (subject to experimental gate and other preflight)

#### Scenario: Both brand manifests present fails
- **WHEN** both `apm.yml` and `bapm.yml` exist in the project root
- **THEN** publish MUST fail with the dual-conflict rule and MUST NOT upload

### Requirement: Flat registry zip layout with apm.yml at root
Publish pack (when not using `--zip`) MUST build a **flat** zip whose root contains `apm.yml` (recommended wire name even when the authoring tree used `bapm.yml`), a `.apm/` tree when present/required, and MAY include optional root docs (README/CHANGELOG/LICENSE). The archive MUST NOT be an APM `--format plugin` / M7 pack wrapper layout. Missing `.apm/` MUST fail closed unless `--zip` supplies a prebuilt archive.

#### Scenario: Flat zip has apm.yml at root
- **WHEN** publish builds an archive from a valid project
- **THEN** the zip root MUST contain `apm.yml` and MUST include `.apm/` when required by preflight

#### Scenario: Missing .apm fails without --zip
- **WHEN** publish runs without `--zip` on a project lacking required `.apm/`
- **THEN** publish MUST fail closed and MUST NOT upload

### Requirement: Upload via registry PUT with dry-run and zip flags
Publish MUST upload via the registry client PUT to `/v1/packages/{owner}/{repo}/versions/{version}` unless `--dry-run` is set. `--dry-run` MUST build/validate (as documented) without performing PUT. `--zip <path>` MUST upload the given archive without rebuilding. HTTP 409 MUST yield non-zero immutability messaging; 422 validation; 401/403 auth remediation.

#### Scenario: Dry-run performs no PUT
- **WHEN** `publish --dry-run` succeeds preflight
- **THEN** no HTTP PUT MUST be issued

#### Scenario: --zip uploads without rebuild
- **WHEN** `publish --zip <archive>` is invoked with a valid zip and gate enabled
- **THEN** the client MUST PUT that archive bytes without rebuilding from the project tree

#### Scenario: 409 immutability message
- **WHEN** the registry returns 409 for the version
- **THEN** publish MUST exit non-zero and message MUST indicate version immutability / bump

### Requirement: Opt-in experimental gate for publish
Publish MUST be gated behind an opt-in experimental mechanism (CLI flag and/or env such as `BAPM_EXPERIMENTAL_REGISTRIES=1` / documented publish enable) so accidental publishes are avoided by default. When the gate is off, publish MUST fail closed with a diagnostic naming how to enable it.

#### Scenario: Publish refused when gate off
- **WHEN** publish is invoked without the experimental gate enabled
- **THEN** the command MUST exit non-zero without upload and MUST explain how to enable registries/publish

#### Scenario: Publish proceeds when gate on
- **WHEN** the experimental gate is enabled and other preflight succeeds
- **THEN** publish MAY proceed to pack and/or upload per flags

### Requirement: Publish is distinct from M7 pack
`publish` MUST NOT rewrite or replace the M7 `pack` product. Pack remains the plain-zip producer archive path; publish MAY reuse low-level zip I/O helpers only.

#### Scenario: pack command still exists independently
- **WHEN** help or dispatch is inspected after M10
- **THEN** `pack` MUST remain a registered command with M7 semantics and MUST NOT be aliased solely to registry publish
