## MODIFIED Requirements

### Requirement: Consumer marketplace command group
The CLI MUST register a top-level `marketplace` command that accepts subcommands `add`, `list`, `browse`, `update`, `remove`, and `validate`. Help for the group and top-level help MUST list `marketplace` as a consumer command. Unknown marketplace subcommands and unknown flags MUST fail closed with non-zero exit and a clear error. Authoring subcommands (`init`, `migrate`, `check`, `outdated`, `audit`, `package`, `build`) MUST NOT be registered. Nested `marketplace search` MAY remain unregistered in this change; top-level `search` is owned by the `cli-search` capability.

#### Scenario: Top-level help mentions marketplace
- **WHEN** `runCli(["help"])` is invoked
- **THEN** stdout MUST mention `marketplace` and the exit code MUST be `0`

#### Scenario: Unknown marketplace subcommand fails closed
- **WHEN** `runCli(["marketplace", "init"])` (or any unregistered subcommand) is invoked
- **THEN** the exit code MUST be non-zero and no registry mutation MUST occur

#### Scenario: Authoring subcommands remain absent
- **WHEN** `runCli(["marketplace", "package"])` (or another authoring token) is invoked
- **THEN** the exit code MUST be non-zero and no authoring workflow MUST run
