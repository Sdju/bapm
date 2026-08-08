## MODIFIED Requirements

### Requirement: Marketplace command is registered in CLI dispatch

Invoking `marketplace` MUST be recognized by CLI dispatch and MUST route through the FEOD marketplace command → module path. The command MUST NOT be treated as an unknown top-level command. Top-level help (`help` / default) MUST list `marketplace` among available commands. Top-level `search` and marketplace-ref install are specified by `cli-search` and `install-pipeline` for this change.

#### Scenario: marketplace is not an unknown command

- **WHEN** `runCli(["marketplace", "list"])` is called
- **THEN** the CLI MUST NOT treat `marketplace` as an unknown command

#### Scenario: help lists marketplace

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST mention `marketplace` and the return code MUST be `0`

## ADDED Requirements

### Requirement: Search command is registered in CLI dispatch

Invoking `search` MUST be recognized by CLI dispatch and MUST route through the FEOD search command → module path. The command MUST NOT be treated as an unknown top-level command. Top-level help (`help` / default) MUST list `search` among available commands.

#### Scenario: search is not an unknown command

- **WHEN** `runCli(["search", "--help"])` is called
- **THEN** the CLI MUST NOT treat `search` as an unknown command and exit MUST be `0`

#### Scenario: help lists search

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST mention `search` and the return code MUST be `0`
