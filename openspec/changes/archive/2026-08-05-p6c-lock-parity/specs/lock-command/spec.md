## ADDED Requirements

### Requirement: lock export subcommand emits SBOM inventory

The `lock` CLI surface MUST accept subcommand `export` (group-style: bare `lock` remains resolve+write; `lock export` is inventory export). `bapm lock export` MUST load the existing project lockfile (dual-brand discovery), invoke core SBOM export, and write the SBOM JSON to stdout by default or to `--output` / `-o` when provided. Supported `--format` / `-f` values MUST be `cyclonedx` (default) and `spdx`. Optional `--timestamp` MUST pin the SBOM timestamp when supplied. Export MUST NOT resolve, download, rewrite the lock, or deploy. Missing lock MUST exit non-zero with an explanation on stderr and empty stdout. When writing to stdout (no `-o`), the SBOM body MUST be the only stdout content; diagnostics and `-o` success messages MUST go to stderr. Unknown export flags/format MUST fail closed (not soft-ignored).

#### Scenario: Default export writes CycloneDX to stdout

- **WHEN** `runCli(["lock", "export"])` runs in a project with a valid lockfile and no `-o`
- **THEN** the exit code MUST be `0`, stdout MUST be CycloneDX 1.5 JSON only, and the lockfile MUST be unchanged

#### Scenario: SPDX format and output file

- **WHEN** `runCli(["lock", "export", "-f", "spdx", "-o", "sbom.json"])` runs with a valid lock
- **THEN** the exit code MUST be `0`, `sbom.json` MUST contain SPDX 2.3 JSON, and stdout MUST NOT contain the SBOM body

#### Scenario: Missing lock fails with empty stdout

- **WHEN** `runCli(["lock", "export"])` runs in a directory with no lockfile
- **THEN** the exit code MUST be non-zero, stderr MUST explain the missing lock, and stdout MUST be empty

#### Scenario: Export does not mutate lock mtime path content

- **WHEN** `lock export` succeeds
- **THEN** the existing lockfile MUST remain byte-identical (no rewrite)

#### Scenario: Unknown export format fails closed

- **WHEN** `runCli(["lock", "export", "--format", "not-a-format"])` is invoked
- **THEN** the exit code MUST be non-zero and no successful SBOM MUST be written to stdout

### Requirement: Deterministic export with timestamp pin

`lock export` MUST accept `--timestamp` and honor `SOURCE_DATE_EPOCH` per core timestamp order. Two exports of the same lock with the same pinned timestamp and format MUST produce byte-identical SBOM bodies.

#### Scenario: Repeated export with pinned timestamp is identical

- **WHEN** `lock export --timestamp <same>` is run twice against the same lock and format
- **THEN** the two SBOM outputs MUST be byte-identical

## MODIFIED Requirements

### Requirement: lock supports update verbose and parallel-downloads flags

The `lock` command MUST accept `--update` (force re-resolve of refs), `--verbose` / `-v`, and `--parallel-downloads` (default parallel download concurrency aligned with APM default 4 unless overridden). Value `0` MUST be accepted and MUST mean serial downloads (APM semantics). The command MUST also accept `--policy <path>` and `--no-policy` when policy gating is wired (passing them through to core). Unimplemented APM flags (`--global`, `--target`) MUST NOT be required in this change. Subcommand `lock export` is in scope (see export requirement).

#### Scenario: --update forces re-resolve

- **WHEN** `runCli(["lock", "--update"])` is invoked
- **THEN** core MUST run in update mode so pins can move to newer satisfying refs

#### Scenario: parallel-downloads flag accepted

- **WHEN** `runCli(["lock", "--parallel-downloads", "2"])` is invoked on a valid project
- **THEN** the command MUST accept the flag and pass the concurrency to core download orchestration (or documented equivalent)

#### Scenario: parallel-downloads 0 means serial

- **WHEN** `runCli(["lock", "--parallel-downloads", "0"])` is invoked on a valid project
- **THEN** the command MUST accept the flag and MUST run downloads serially (concurrency treated as 1)

#### Scenario: lock accepts no-policy escape

- **WHEN** `runCli(["lock", "--no-policy"])` is invoked with a blocking local policy present
- **THEN** the command MUST accept the flag and MUST skip the policy gate

### Requirement: lock does not claim install or target deploy

The `lock` command MUST NOT initialize targets, MUST NOT copy packages into harness dirs, and MUST NOT deploy primitives. After M4, `install` MAY deploy via registered targets, but `lock` MUST remain non-deploying and MUST NOT invoke target `materialize`. Bare lock MUST NOT call MCP configure or orphan deletes. `lock export` MUST likewise leave harness dirs untouched.

#### Scenario: Harness dirs unchanged after lock

- **WHEN** `lock` succeeds on a fixture project that already contains cursor/agents-style dirs
- **THEN** those dirs MUST NOT gain new deployed primitive files from the lock command

#### Scenario: lock does not call target materialize

- **WHEN** `lock` runs in an environment where a target is registered for install e2e
- **THEN** the lock path MUST NOT invoke that target's materialize contract

#### Scenario: Harness dirs unchanged after lock export

- **WHEN** `lock export` succeeds on a fixture that contains `.cursor/` or similar harness dirs
- **THEN** those dirs MUST NOT be modified by export
