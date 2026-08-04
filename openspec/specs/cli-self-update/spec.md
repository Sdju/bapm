# cli-self-update Specification

## Purpose

Thin `bapm self-update` provides `--check` against a single primary release-metadata source (npm or GitHub—fixed in design) and documents one upgrade path, refusing false “latest” claims when the running version is unknown.

## Requirements

### Requirement: self-update --check compares to latest channel
Invoking `self-update --check` MUST compare the running CLI version to the latest published version for the configured channel and MUST print clear messaging when an update is available versus when the CLI is up-to-date. Exit policy for “update available” MUST be documented (zero with message, or non-zero—pick one and keep consistent in help/tests).

#### Scenario: Newer remote reports update available
- **WHEN** stubbed latest is greater than the running version and `--check` runs
- **THEN** stdout/stderr MUST report that an update is available and MUST name the newer version

#### Scenario: Current version reports up-to-date
- **WHEN** stubbed latest equals the running version and `--check` runs
- **THEN** messaging MUST indicate up-to-date / no update needed

### Requirement: Unknown or placeholder version refuses false latest claim
When the running version is undetermined, `0.0.0`, or otherwise documented as unknown, `self-update --check` MUST NOT claim the CLI is the latest. It MUST warn or skip with a clear diagnostic.

#### Scenario: Unknown version does not claim latest
- **WHEN** running version is `0.0.0` or unknown and `--check` runs
- **THEN** output MUST warn or skip and MUST NOT assert that the CLI is up-to-date as latest

### Requirement: Help documents supported upgrade path
Help for `self-update` MUST document the supported upgrade command or path (the primary install path chosen in design, e.g. `npm i -g bapm@…` or equivalent). `--check` alone satisfies the MUST bar only when help documents that upgrade path as supported.

#### Scenario: Help lists upgrade path
- **WHEN** `self-update --help` or top-level help covering self-update is shown
- **THEN** text MUST mention `--check` and the documented upgrade/install command

### Requirement: Optional one upgrade path without --check
When `self-update` is invoked without `--check`, the system SHOULD run the documented installer/upgrade path when enabled (and MAY respect a packager kill-switch env). If the upgrade path is not shipped in MVP, `--check` plus documented manual upgrade MUST still meet the MUST bar.

#### Scenario: Upgrade path invoked or documented
- **WHEN** `self-update` runs without `--check` and the upgrade path is implemented
- **THEN** the documented installer/update mechanism MUST be attempted (or clearly refused if kill-switched)

### Requirement: Channel selection via env or flag
Channel selection MUST support at least `stable` (default) and MAY support `prerelease` via env/config/flag documented in help.

#### Scenario: Stable channel is default
- **WHEN** `self-update --check` runs without an explicit channel
- **THEN** comparison MUST use the stable channel metadata source
