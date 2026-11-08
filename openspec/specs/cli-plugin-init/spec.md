# cli-plugin-init Specification

## Purpose

Defines the top-level producer CLI group `bapm plugin` with the thin `init` verb that scaffolds either a minimal APM plugin project (`plugin.json` + plugin-mode `bapm.yml`) or an Agent Plugins v1 portable root (`plugin.json` only), without network or full authoring suite.

## Requirements

### Requirement: Top-level plugin group with init subcommand

The CLI MUST register a top-level `plugin` command group with an `init` subcommand (noun-verb). Invocation MUST NOT require a legacy `init --plugin` flag. `bapm plugin --help` and `bapm plugin init --help` MUST document `init` and the accepted flags. Unknown flags on `plugin` / `plugin init` MUST fail closed with non-zero exit. The command path MUST NOT perform network, marketplace, or registry I/O.

#### Scenario: plugin help lists init

- **WHEN** `runCli(["plugin", "--help"])` or `runCli(["plugin", "-h"])` is invoked
- **THEN** exit code MUST be `0` and help text MUST mention `init`

#### Scenario: plugin init help documents flags

- **WHEN** `runCli(["plugin", "init", "--help"])` or `runCli(["plugin", "init", "-h"])` is invoked
- **THEN** exit code MUST be `0` and help text MUST mention `--yes` / `-y`, optional project name, `--target`, `--agent-plugins`, and `--skills`

#### Scenario: Unknown plugin init flag fails closed

- **WHEN** `runCli(["plugin", "init", "--not-a-flag"])` is invoked
- **THEN** exit code MUST be non-zero and the error MUST identify the unknown flag

### Requirement: Non-interactive APM plugin init scaffolds two files

`bapm plugin init --yes` (or `-y`) without `--agent-plugins` in a directory whose basename is a valid kebab-case plugin id MUST write exactly `plugin.json` and `bapm.yml` in that directory and MUST exit `0`. The command MUST NOT create `SKILL.md`, MUST NOT create empty `agents/` or `skills/` directories, and MUST NOT create `start.prompt` as part of the APM scaffold.

#### Scenario: plugin init --yes writes both files

- **WHEN** `runCli(["plugin", "init", "--yes"])` runs in an empty cwd whose basename matches `^[a-z][a-z0-9-]{0,63}$`
- **THEN** exit code MUST be `0`, both `plugin.json` and `bapm.yml` MUST exist, and neither `SKILL.md` nor empty `agents/` / `skills/` directories MUST be created by the command

### Requirement: Optional PROJECT_NAME subdirectory

When a positional `PROJECT_NAME` is provided, `plugin init` MUST create a subdirectory of that name (when missing), write the selected scaffold there (`plugin.json` and, in APM mode, `bapm.yml`), and set `plugin.json` `name` equal to `PROJECT_NAME` when the name is valid. Path separators and `..` in `PROJECT_NAME` MUST be rejected with non-zero exit.

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

When the scaffold target files for the selected mode already exist (`plugin.json`, and in APM mode `bapm.yml`), `plugin init` without `--yes` MUST refuse with non-zero exit and MUST NOT overwrite. With `--yes`, `plugin init` MUST overwrite `plugin.json` and, in APM mode, `bapm.yml` as needed and exit `0` on success. Consumer `bapm init` refuse-overwrite behavior MUST remain unchanged by this requirement.

#### Scenario: Existing bapm.yml without --yes refuses

- **WHEN** `runCli(["plugin", "init"])` runs in a directory that already has `bapm.yml` and `--yes` is omitted
- **THEN** exit code MUST be non-zero and the existing `bapm.yml` MUST remain unchanged

#### Scenario: Existing bapm.yml with --yes overwrites

- **WHEN** `runCli(["plugin", "init", "--yes"])` runs in a directory that already has `bapm.yml` with a valid kebab-case basename
- **THEN** exit code MUST be `0` and `bapm.yml` / `plugin.json` MUST reflect the new plugin scaffold

### Requirement: Agent Plugins v1 portable scaffold

`plugin init --agent-plugins` MUST write a canonical Agent Plugins v1 `plugin.json` and MUST NOT write `bapm.yml`. Without `--skills`, it MUST NOT create a `skills/` directory or `SKILL.md`. With `--skills`, it MUST additionally create a minimal `skills/example/SKILL.md` layout. `--skills` without `--agent-plugins` MUST be accepted and MUST NOT add the portable skills layout to the APM scaffold. The portable path MUST remain offline and MUST NOT perform network, marketplace, or registry I/O.

#### Scenario: --agent-plugins writes portable root without bapm.yml

- **WHEN** `runCli(["plugin", "init", "--yes", "--agent-plugins"])` runs in an empty cwd whose basename is a valid kebab-case plugin id
- **THEN** exit code MUST be `0`, `plugin.json` MUST exist and be a canonical Agent Plugins v1 manifest, `bapm.yml` MUST NOT exist, and `skills/` MUST NOT be created

#### Scenario: --agent-plugins --skills adds example skill

- **WHEN** `runCli(["plugin", "init", "--yes", "--agent-plugins", "--skills"])` runs in an empty cwd
- **THEN** exit code MUST be `0` and `skills/example/SKILL.md` MUST exist alongside the portable `plugin.json`

### Requirement: Optional target and verbose flags

`plugin init` MUST accept `--target <id>` (single id) and MUST write that target into `bapm.yml` as the narrowing `target: <id>` field (not `targets`). `--target` MUST be rejected together with `--agent-plugins` with non-zero exit and an error explaining the incompatibility. `-v` / `--verbose` MUST be accepted (MAY be a no-op beyond extra logging). Combining unknown flags MUST still fail closed.

#### Scenario: --target writes narrowing host target

- **WHEN** `runCli(["plugin", "init", "--yes", "--target", "cursor"])` runs for a valid plugin name cwd
- **THEN** exit code MUST be `0` and the written `bapm.yml` MUST record `target: cursor`

#### Scenario: --target with --agent-plugins fails closed

- **WHEN** `runCli(["plugin", "init", "--yes", "--target", "cursor", "--agent-plugins"])` is invoked
- **THEN** exit code MUST be non-zero, stderr MUST explain that `--target` cannot be used with `--agent-plugins`, and no scaffold files MUST be written

#### Scenario: --verbose is accepted

- **WHEN** `runCli(["plugin", "init", "--yes", "--verbose"])` or `runCli(["plugin", "init", "--yes", "-v"])` runs for a valid plugin name cwd
- **THEN** exit code MUST be `0` and both scaffold files MUST exist

### Requirement: Success next-steps mention pack and install-dev style hints

On successful APM `plugin init`, stdout MUST include next-steps text that mentions `bapm pack` and an install-dev style hint (`bapm install --dev`). On successful portable `plugin init --agent-plugins`, stdout MUST mention `bapm pack --agent-plugins`. Mentions MUST be textual only and MUST NOT implement pack or publish behavior in this command.

#### Scenario: Success stdout mentions pack hint

- **WHEN** `runCli(["plugin", "init", "--yes"])` succeeds
- **THEN** stdout MUST mention `bapm pack` (or equivalent pack command wording) as a future/next step
