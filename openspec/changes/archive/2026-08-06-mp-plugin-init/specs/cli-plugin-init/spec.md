## Purpose

Defines the top-level producer CLI group `bapm plugin` with the thin `init` verb that scaffolds a minimal plugin project (`plugin.json` + plugin-mode `bapm.yml`) without network or full authoring suite.

## ADDED Requirements

### Requirement: Top-level plugin group with init subcommand
The CLI MUST register a top-level `plugin` command group with an `init` subcommand (noun-verb). Invocation MUST NOT require a legacy `init --plugin` flag. `bapm plugin --help` and `bapm plugin init --help` MUST document `init` and the accepted flags. Unknown flags on `plugin` / `plugin init` MUST fail closed with non-zero exit. The command path MUST NOT perform network, marketplace, or registry I/O.

#### Scenario: plugin help lists init
- **WHEN** `runCli(["plugin", "--help"])` or `runCli(["plugin", "-h"])` is invoked
- **THEN** exit code MUST be `0` and help text MUST mention `init`

#### Scenario: plugin init help documents flags
- **WHEN** `runCli(["plugin", "init", "--help"])` or `runCli(["plugin", "init", "-h"])` is invoked
- **THEN** exit code MUST be `0` and help text MUST mention `--yes` / `-y` and optional project name

#### Scenario: Unknown plugin init flag fails closed
- **WHEN** `runCli(["plugin", "init", "--not-a-flag"])` is invoked
- **THEN** exit code MUST be non-zero and the error MUST identify the unknown flag

### Requirement: Non-interactive plugin init scaffolds two files
`bapm plugin init --yes` (or `-y`) in a directory whose basename is a valid kebab-case plugin id MUST write exactly `plugin.json` and `bapm.yml` in that directory and MUST exit `0`. The command MUST NOT create `SKILL.md`, MUST NOT create empty `agents/` or `skills/` directories, and MUST NOT create `start.prompt` as part of the scaffold.

#### Scenario: plugin init --yes writes both files
- **WHEN** `runCli(["plugin", "init", "--yes"])` runs in an empty cwd whose basename matches `^[a-z][a-z0-9-]{0,63}$`
- **THEN** exit code MUST be `0`, both `plugin.json` and `bapm.yml` MUST exist, and neither `SKILL.md` nor empty `agents/` / `skills/` directories MUST be created by the command

### Requirement: Optional PROJECT_NAME subdirectory
When a positional `PROJECT_NAME` is provided, `plugin init` MUST create a subdirectory of that name (when missing), write `plugin.json` and `bapm.yml` inside it, and set `plugin.json` `name` equal to `PROJECT_NAME` when the name is valid. Path separators and `..` in `PROJECT_NAME` MUST be rejected with non-zero exit.

#### Scenario: PROJECT_NAME creates subdirectory scaffold
- **WHEN** `runCli(["plugin", "init", "--yes", "my-plugin"])` runs in an empty parent directory
- **THEN** exit code MUST be `0`, files MUST exist at `my-plugin/plugin.json` and `my-plugin/bapm.yml`, and `plugin.json` `name` MUST equal `my-plugin`

#### Scenario: PROJECT_NAME with path separator fails
- **WHEN** `runCli(["plugin", "init", "--yes", "foo/bar"])` is invoked
- **THEN** exit code MUST be non-zero and no plugin scaffold files MUST be written for that path

### Requirement: Invalid plugin name fails closed
Plugin names that fail kebab-case validation (uppercase, underscore, leading digit or hyphen, empty, length greater than 64) MUST cause non-zero exit with a clear error mentioning invalid plugin name. No scaffold files MUST be written on validation failure.

#### Scenario: Uppercase plugin name rejected
- **WHEN** `runCli(["plugin", "init", "--yes", "MyPlugin"])` is invoked
- **THEN** exit code MUST be non-zero and stderr MUST mention invalid plugin name

#### Scenario: Leading digit plugin name rejected
- **WHEN** `runCli(["plugin", "init", "--yes", "1bad"])` is invoked
- **THEN** exit code MUST be non-zero and stderr MUST mention invalid plugin name

### Requirement: Overwrite existing manifest only with --yes
When `bapm.yml` (or existing plugin scaffold targets) already exist in the destination directory, `plugin init` without `--yes` MUST refuse with non-zero exit and MUST NOT overwrite. With `--yes`, `plugin init` MUST overwrite `bapm.yml` and `plugin.json` as needed and exit `0` on success. Consumer `bapm init` refuse-overwrite behavior MUST remain unchanged by this requirement.

#### Scenario: Existing bapm.yml without --yes refuses
- **WHEN** `runCli(["plugin", "init"])` runs in a directory that already has `bapm.yml` and `--yes` is omitted
- **THEN** exit code MUST be non-zero and the existing `bapm.yml` MUST remain unchanged

#### Scenario: Existing bapm.yml with --yes overwrites
- **WHEN** `runCli(["plugin", "init", "--yes"])` runs in a directory that already has `bapm.yml` with a valid kebab-case basename
- **THEN** exit code MUST be `0` and `bapm.yml` / `plugin.json` MUST reflect the new plugin scaffold

### Requirement: Optional target and verbose flags
`plugin init` MUST accept `--target <id>` (single id) and MAY write that target into `bapm.yml`. `-v` / `--verbose` MUST be accepted (MAY be a no-op beyond extra logging). Combining unknown flags MUST still fail closed.

#### Scenario: --target writes host target
- **WHEN** `runCli(["plugin", "init", "--yes", "--target", "cursor"])` runs for a valid plugin name cwd
- **THEN** exit code MUST be `0` and the written `bapm.yml` MUST record `target` or `targets` containing `cursor`

#### Scenario: --verbose is accepted
- **WHEN** `runCli(["plugin", "init", "--yes", "--verbose"])` or `runCli(["plugin", "init", "--yes", "-v"])` runs for a valid plugin name cwd
- **THEN** exit code MUST be `0` and both scaffold files MUST exist

### Requirement: Success next-steps mention pack and install-dev style hints
On successful `plugin init`, stdout MUST include next-steps text that mentions `bapm pack` and an install-dev style hint. Mentions MUST be textual only and MUST NOT implement pack or publish behavior in this command.

#### Scenario: Success stdout mentions pack hint
- **WHEN** `runCli(["plugin", "init", "--yes"])` succeeds
- **THEN** stdout MUST mention `bapm pack` (or equivalent pack command wording) as a future/next step
