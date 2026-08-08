## ADDED Requirements

### Requirement: Producer commands init and pack are registered

Invoking `init` and `pack` MUST be recognized by CLI dispatch (not treated as unknown commands). Each MUST invoke a thin FEOD command → module path that calls the corresponding `@bapm/core` producer API. Unknown flags on these commands MUST hard-error with non-zero exit. Help text for install MUST mention that a local pack archive path is an accepted install source when that path is implemented.

#### Scenario: init and pack are not unknown

- **WHEN** `runCli(["init", "-y", "demo"])` or `runCli(["pack", "--archive"])` is called in an appropriate fixture context
- **THEN** the CLI MUST NOT treat `init` or `pack` as an unknown command

#### Scenario: Unknown flag on pack fails

- **WHEN** `runCli(["pack", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

#### Scenario: Install accepts archive path argument

- **WHEN** `runCli(["install", "/path/to/pack.zip"])` is invoked with a pack-produced archive
- **THEN** the CLI MUST NOT treat the archive path as an unknown command and MUST apply install-from-archive semantics from `install-pipeline` / `producer-pack-archive`

## MODIFIED Requirements

### Requirement: Help command prints usage

Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, and `pack` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), including consumption of a local pack archive path when supported, not a permanent stub disclaimer, and MUST be consistent with the install-help requirement for the supported flag subset. Lifecycle and producer commands MUST NOT be described as permanent stubs.

#### Scenario: help subcommand succeeds

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, and `pack`, and the return code MUST be `0`

#### Scenario: default command is help

- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`
