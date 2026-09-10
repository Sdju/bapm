## ADDED Requirements

### Requirement: Pack accepts --check-versions flag

`bapm pack` MUST accept `--check-versions` as a known flag and MUST invoke the marketplace version-alignment gate defined by `producer-pack-check-versions`. Pack help MUST document `--check-versions` as distinct from `--check-release`. Unknown pack flags MUST still fail closed. Existing `--archive`, `--dry-run`, `--check-release`, `--tag`, `--marketplace`, `--marketplace-path`, `--offline`, `--include-prerelease`, and `--agent-plugins` behaviors MUST remain; sc-007 secret refuse and pr-004 `--check-release` MUST NOT regress. `--check-versions` MUST NOT be treated as a required precondition for M7 plain-zip archive success when the flag is absent.

#### Scenario: Pack help mentions check-versions

- **WHEN** `runCli(["pack", "--help"])` is invoked after this change
- **THEN** help text MUST mention `--check-versions` and MUST still mention `--check-release`

#### Scenario: Unknown pack flag still fails

- **WHEN** `runCli(["pack", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

#### Scenario: Archive without check-versions still succeeds

- **WHEN** pack `--archive` runs on a conforming project without `--check-versions`
- **THEN** plain-zip success MUST NOT require version-alignment gate execution

## MODIFIED Requirements

### Requirement: Pack marketplace CLI flags

`bapm pack` MUST accept `--marketplace` (`all` | `none` | comma-separated format list), repeatable `--marketplace-path FORMAT=PATH`, and marketplace-aware `--offline`. Unknown pack flags MUST still fail closed. Pack help MUST document marketplace emit mode. Existing `--archive`, `--dry-run`, `--check-release`, `--check-versions`, and `--tag` behaviors MUST remain; sc-007 secret refuse and pr-004 `--check-release` MUST NOT regress. Marketplace `--check-versions` remains optional and orthogonal to M7 plain-zip success (see `producer-pack-check-versions`).

#### Scenario: Pack help mentions marketplace

- **WHEN** `runCli(["pack", "--help"])` is invoked after this change
- **THEN** help text MUST mention marketplace output flags or emit behavior

#### Scenario: Unknown pack flag still fails

- **WHEN** `runCli(["pack", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

#### Scenario: Dry-run skips durable zip and marketplace JSON

- **WHEN** pack runs with `--dry-run` on a project that would otherwise write zip and marketplace.json
- **THEN** neither a durable zip nor durable marketplace.json MUST remain as published output
