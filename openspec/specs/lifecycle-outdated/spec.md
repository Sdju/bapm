# lifecycle-outdated Specification

## Purpose

Defines `bapm outdated` reporting of lock pins versus remote tips so operators can see drift without treating outdated rows as a CI failure gate.

## Requirements

### Requirement: Outdated compares lock pins to remote tips
Given a project lockfile, outdated MUST compare locked pins to remote tip / latest matching semver tag (for supported git kinds) and MUST report rows with status among `outdated`, `up-to-date`, and `unknown` (or equivalent documented labels).

#### Scenario: Up-to-date lock reports success
- **WHEN** lock pins match remote tips for all checked deps and outdated runs
- **THEN** output MUST indicate all up-to-date (or an equivalent success summary) and the exit code MUST be `0`

#### Scenario: Outdated row when tip ahead
- **WHEN** a branch or tag tip is ahead of the locked SHA/tag and outdated runs
- **THEN** output MUST include a row with status outdated showing current and latest identifiers

### Requirement: No lockfile yields non-zero
When no lockfile is discoverable via dual-read rules, outdated MUST exit non-zero with a clear error.

#### Scenario: Missing lock fails
- **WHEN** outdated runs in a project without `apm.lock.yaml` or `bapm.lock.yaml`
- **THEN** the exit code MUST be non-zero

### Requirement: Outdated exit policy mirrors APM (not CI gate)
When outdated packages are found, outdated MUST still exit `0` (warning/summary only). Continuous-integration fail-closed integrity MUST use `audit --ci`, not outdated exit status.

#### Scenario: Outdated found still exits zero
- **WHEN** at least one dependency row is outdated
- **THEN** the command MUST exit `0` after reporting those rows
