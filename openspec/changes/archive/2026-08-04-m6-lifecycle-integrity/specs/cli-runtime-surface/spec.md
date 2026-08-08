## ADDED Requirements

### Requirement: Lifecycle integrity commands are registered

Invoking `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, and `doctor` MUST be recognized by CLI dispatch (not treated as unknown commands). Each MUST invoke a thin FEOD command → module path that calls the corresponding `@bapm/core` lifecycle/integrity API. Unknown flags on these commands MUST hard-error with non-zero exit.

#### Scenario: Update is not unknown

- **WHEN** `runCli(["update", "--help"])` or `runCli(["update", "--dry-run"])` is called in a valid project context
- **THEN** the CLI MUST NOT treat `update` as an unknown command

#### Scenario: Unknown flag on lifecycle command fails

- **WHEN** `runCli(["outdated", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: deps subcommands list and tree are runnable

Invoking `deps list` and `deps tree` MUST be recognized and MUST exit according to the `deps-inspect` capability. `deps why` MAY be registered when implemented.

#### Scenario: deps list is not unknown

- **WHEN** `runCli(["deps", "list"])` is called against a project with a lock
- **THEN** the CLI MUST NOT treat `deps` or `list` as an unknown command path

### Requirement: audit --ci is the CI integrity gate surface

Invoking `audit --ci` MUST run the core audit CI gate and MUST map exit codes 0/1 per `audit-integrity`.

#### Scenario: audit --ci is not unknown

- **WHEN** `runCli(["audit", "--ci"])` is called
- **THEN** the CLI MUST NOT treat `audit` as an unknown command and MUST apply CI gate semantics

## MODIFIED Requirements

### Requirement: Help command prints usage

Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, and `doctor` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), not a permanent stub disclaimer, and MUST be consistent with the install-help requirement for the supported flag subset. Lifecycle commands MUST NOT be described as permanent stubs.

#### Scenario: help subcommand succeeds

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, `lock`, `update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, and `doctor`, and the return code MUST be `0`

#### Scenario: default command is help

- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`
