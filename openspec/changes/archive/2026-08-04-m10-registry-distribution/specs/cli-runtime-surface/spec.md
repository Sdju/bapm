## MODIFIED Requirements

### Requirement: Help command prints usage

Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, `pack`, `compile`, `cache`, `publish`, and `self-update` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), including consumption of a local pack archive path when supported, not a permanent stub disclaimer, and MUST be consistent with the install-help requirement for the supported flag subset. Help MUST mention the MCP path (install-time MCP and/or thin `mcp` command when registered). Lifecycle and producer commands MUST NOT be described as permanent stubs.

#### Scenario: help subcommand succeeds

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`, `init`, `pack`, `compile`, `cache`, `publish`, and `self-update`, and the return code MUST be `0`

#### Scenario: default command is help

- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

## ADDED Requirements

### Requirement: Publish command is registered

Invoking `publish` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@bapm/core` publish APIs (subject to experimental gate). Unknown flags MUST hard-error with non-zero exit.

#### Scenario: publish is not unknown

- **WHEN** `runCli(["publish", "--help"])` or gated publish dry-run is invoked
- **THEN** the CLI MUST NOT treat `publish` as an unknown command

#### Scenario: Unknown publish flag fails

- **WHEN** `runCli(["publish", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: Self-update command is registered

Invoking `self-update` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path. `--check` MUST be supported. Unknown flags MUST hard-error with non-zero exit.

#### Scenario: self-update is not unknown

- **WHEN** `runCli(["self-update", "--check"])` is called (with stubbed metadata as needed)
- **THEN** the CLI MUST NOT treat `self-update` as an unknown command

#### Scenario: Unknown self-update flag fails

- **WHEN** `runCli(["self-update", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag
