# producer-release-gate Specification

## Purpose

Provides an explicit OpenAPM pr-004 git-tag↔manifest-version gate on pack, with pr-005 unsigned-tag advisory only and no auto tag create/push.

## Requirements

### Requirement: pack --check-release validates tag against manifest version

Invoking `pack --check-release` MUST compare a release tag under check to the dual-read manifest `version` at the project under check. An optional leading `v` on the tag MUST be stripped for equality. When the intended gate is git-semver consumption, the tag MUST match OpenAPM semver-with-optional-`v` regex; mismatch or non-semver tag MUST fail closed with non-zero exit. The check MUST NOT create or push git tags.

#### Scenario: Aligned tag passes

- **WHEN** manifest `version` is `"1.2.3"` and the tag under check is `v1.2.3` or `1.2.3`
- **THEN** `--check-release` MUST pass (exit `0` for the gate portion)

#### Scenario: Mismatched tag fails

- **WHEN** manifest `version` is `"1.2.3"` and the tag under check is `v9.9.9`
- **THEN** `--check-release` MUST exit non-zero

#### Scenario: Non-semver release tag fails

- **WHEN** the tag under check is `release-foo` and the git-semver release gate is active
- **THEN** `--check-release` MUST exit non-zero citing tag shape / regex failure

### Requirement: Tag under check is HEAD tag or supplied --tag

The release gate MUST accept an explicit `--tag <name>` override. When `--tag` is omitted, the gate MUST use a tag present on the current HEAD (annotated or lightweight) when available; if no tag can be determined, the gate MUST fail closed with a clear diagnostic (MUST NOT silently pass).

#### Scenario: Explicit --tag used

- **WHEN** `pack --check-release --tag v1.0.0` runs against manifest version `1.0.0`
- **THEN** the gate MUST evaluate that supplied tag and MUST NOT require a different HEAD tag for the comparison

#### Scenario: Missing tag fails closed

- **WHEN** `--check-release` runs without `--tag` and HEAD has no resolvable release tag
- **THEN** the exit code MUST be non-zero with a diagnostic that a tag was required

### Requirement: Unsigned tag is advisory only

When a tag under check is unsigned, the system MAY warn (pr-005 SHOULD) but MUST NOT fail solely because the tag is unsigned in M7. Documentation MAY state producer signing guidance without enforcing it.

#### Scenario: Unsigned tag does not hard-fail

- **WHEN** `--check-release` runs against an aligned but unsigned tag
- **THEN** the gate MUST NOT fail solely for lack of signature (MAY emit a warning)

### Requirement: Release gate does not auto-create or push tags

`pack --check-release` and related producer tooling MUST NOT create git tags or push to remotes as part of the M7 check path. Publication remains git-host tags / external release tooling per OpenAPM §7.8.

#### Scenario: Check does not mutate tags

- **WHEN** `--check-release` completes (pass or fail)
- **THEN** the local and remote tag sets MUST be unchanged by the check itself
