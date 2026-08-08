## ADDED Requirements

### Requirement: Marketplace command is registered in CLI dispatch

Invoking `marketplace` MUST be recognized by CLI dispatch and MUST route through the FEOD marketplace command → module path. The command MUST NOT be treated as an unknown top-level command. Top-level help (`help` / default) MUST list `marketplace` among available commands. Resolver/install of `NAME@MARKETPLACE` and top-level `search` MUST remain unavailable in this change.

#### Scenario: marketplace is not an unknown command

- **WHEN** `runCli(["marketplace", "list"])` is called
- **THEN** the CLI MUST NOT treat `marketplace` as an unknown command

#### Scenario: help lists marketplace

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST mention `marketplace` and the return code MUST be `0`

#### Scenario: search remains unregistered

- **WHEN** `runCli(["search", "foo"])` is called
- **THEN** the CLI MUST treat `search` as an unknown command (non-zero exit) in this change
