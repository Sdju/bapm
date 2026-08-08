## ADDED Requirements

### Requirement: Plugin command is registered in CLI dispatch

Invoking `plugin` MUST be recognized by CLI dispatch and MUST route through the FEOD plugin command → module path. The command MUST NOT be treated as an unknown top-level command. Top-level help (`help` / default) MUST list `plugin` among available commands. Behavior of `plugin init` (flags, scaffold files, exits) is specified by `cli-plugin-init` and `plugin-scaffold`.

#### Scenario: plugin is not an unknown command

- **WHEN** `runCli(["plugin", "--help"])` is called
- **THEN** the CLI MUST NOT treat `plugin` as an unknown command and exit MUST be `0`

#### Scenario: help lists plugin

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST mention `plugin` and the return code MUST be `0`
