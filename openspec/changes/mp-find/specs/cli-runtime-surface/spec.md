## ADDED Requirements

### Requirement: Find command is registered in CLI dispatch
Invoking `find` MUST be recognized by CLI dispatch and MUST route through the FEOD find command → module path. The command MUST NOT be treated as an unknown top-level command. Top-level help (`help` / default) MUST list `find` among available commands. Behavior of `find` (flags, exits, offline reverse lookup) is specified by `cli-find` and `find-reverse-index`.

#### Scenario: find is not an unknown command
- **WHEN** `runCli(["find", "--help"])` is called
- **THEN** the CLI MUST NOT treat `find` as an unknown command and exit MUST be `0`

#### Scenario: help lists find
- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST mention `find` and the return code MUST be `0`
