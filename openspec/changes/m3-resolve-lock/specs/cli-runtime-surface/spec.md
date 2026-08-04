## ADDED Requirements

### Requirement: Lock command is registered and runnable
Invoking `lock` MUST be recognized by CLI dispatch and MUST invoke the lock command handler (thin FEOD command → module → `@bapm/core` `resolveAndLock`). Success and failure exit codes MUST follow the `lock-command` capability.

#### Scenario: lock subcommand is not unknown
- **WHEN** `runCli(["lock"])` is called
- **THEN** the CLI MUST NOT treat `lock` as an unknown command

## MODIFIED Requirements

### Requirement: Help command prints usage
Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, and `lock` commands and MUST return exit code `0`.

#### Scenario: help subcommand succeeds
- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, and `lock`, and the return code MUST be `0`

#### Scenario: default command is help
- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

### Requirement: Install command remains a failing stub
Invoking `install` MUST print an error indicating that install is not implemented yet, MUST mention the expected manifest and lock file names from core, and MUST return exit code `1`. M3 MUST NOT turn `install` into a target-deploying command.

#### Scenario: install stub fails with expected files
- **WHEN** `runCli(["install"])` is called
- **THEN** stderr MUST indicate that install is not implemented, MUST mention the expected manifest and lock file names, and the return code MUST be `1`
