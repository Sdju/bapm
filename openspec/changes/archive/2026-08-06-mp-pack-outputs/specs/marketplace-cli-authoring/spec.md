## MODIFIED Requirements

### Requirement: Authoring help section

Marketplace group help and related help text MUST list Authoring subcommands (`init`, `package`, `check`, and `migrate` when shipped) separately from Consumer subcommands. Help MUST NOT claim that pack host marketplace.json emit is unavailable when pack marketplace outputs are shipped. Help MAY direct authors to `bapm pack` for Claude/Codex host artifact emission. Help MUST NOT advertise a restored `marketplace build` verb.

#### Scenario: marketplace help lists Authoring

- **WHEN** `runCli(["marketplace", "help"])` or `runCli(["help", "marketplace"])` (whichever the CLI supports for group help) is invoked
- **THEN** output MUST mention Authoring (or equivalent section) and include `init` and `check`

#### Scenario: Authoring help does not deny pack emit

- **WHEN** marketplace Authoring help is shown after pack marketplace outputs ship
- **THEN** help MUST NOT state that pack host outputs are not shipped
