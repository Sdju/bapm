# cli-view Specification

## Purpose

Defines the top-level consumer CLI command `bapm view <package>` for offline inspection of installed package metadata from lock and modules, with APM-aligned naming and honest exit codes.

## Requirements

### Requirement: Top-level view command

The CLI MUST register a top-level `view` command (not nested under `deps`). Invocation MUST accept a single required positional package query. The command MUST call core offline local-view orchestration and MUST NOT perform network, registry, marketplace, or remote version I/O. The `versions` field selector and `--registry` MUST NOT be accepted in this change (unknown or unsupported). Unknown view flags MUST fail closed with non-zero exit. Help for `view` MUST document the package argument and state that inspection is local/offline.

#### Scenario: View prints local metadata for installed package

- **WHEN** `runCli(["view", "pkg"])` runs in a project whose lock uniquely resolves `pkg` and modules metadata is available
- **THEN** exit code MUST be `0` and stdout MUST include identity and version/pin information for that package

#### Scenario: View missing package exits one

- **WHEN** `runCli(["view", "missing-pkg"])` runs against a readable lock that does not contain that package
- **THEN** exit code MUST be `1`

#### Scenario: View missing lock exits two

- **WHEN** `runCli(["view", "anything"])` runs in a project with no readable lockfile
- **THEN** exit code MUST be `2`

#### Scenario: View without package argument fails

- **WHEN** `runCli(["view"])` is invoked without a package query
- **THEN** exit code MUST be non-zero

#### Scenario: Unknown view flag fails closed

- **WHEN** `runCli(["view", "pkg", "--not-a-flag"])` is invoked
- **THEN** exit code MUST be non-zero and the error MUST identify the unknown flag

#### Scenario: View rejects versions field in this change

- **WHEN** `runCli(["view", "pkg", "versions"])` is invoked
- **THEN** exit code MUST be non-zero (versions / remote listing is out of scope)

#### Scenario: View help documents local inspect

- **WHEN** `runCli(["view", "--help"])` or `runCli(["view", "-h"])` is invoked
- **THEN** exit code MUST be `0` and help text MUST mention the package argument and local/offline inspection
