## ADDED Requirements

### Requirement: View command is registered in CLI dispatch

Invoking `view` MUST be recognized by CLI dispatch and MUST route through the FEOD view command → module path. The command MUST NOT be treated as an unknown top-level command. Top-level help (`help` / default) MUST list `view` among available commands. Behavior of `view` (arguments, exits, offline local inspect) is specified by `cli-view` and `view-local-inspect`.

#### Scenario: view is not an unknown command

- **WHEN** `runCli(["view", "--help"])` is called
- **THEN** the CLI MUST NOT treat `view` as an unknown command and exit MUST be `0`

#### Scenario: help lists view

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST mention `view` and the return code MUST be `0`
