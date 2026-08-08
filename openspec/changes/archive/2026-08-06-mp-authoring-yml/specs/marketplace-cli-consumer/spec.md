## MODIFIED Requirements

### Requirement: Consumer marketplace command group

The CLI MUST register a top-level `marketplace` command that accepts consumer subcommands `add`, `list`, `browse`, `update`, `remove`, and `validate`, and MUST also accept authoring subcommands defined by the `marketplace-cli-authoring` capability (`init`, `package`, `check`, and `migrate` when shipped). Help for the group and top-level help MUST list `marketplace` and MUST present Consumer and Authoring sections (or equivalent clear grouping). Unknown marketplace subcommands and unknown flags MUST fail closed with non-zero exit and a clear error. Authoring verbs that remain out of scope for this change (`outdated`, `audit`, `build`) MUST NOT be registered as successful workflows; `build` MUST NOT be claimed as shipped. Nested `marketplace search` MAY remain unregistered; top-level `search` is owned by the `cli-search` capability. Consumer `validate NAME` behavior MUST remain as already shipped (schema/duplicate checks on fetched marketplace.json) and MUST NOT be reworked into an authoring verb.

#### Scenario: Top-level help mentions marketplace

- **WHEN** `runCli(["help"])` is invoked
- **THEN** stdout MUST mention `marketplace` and the exit code MUST be `0`

#### Scenario: Unknown marketplace subcommand fails closed

- **WHEN** `runCli(["marketplace", "outdated"])` (or another unregistered authoring token such as `audit` or `build`) is invoked
- **THEN** the exit code MUST be non-zero and no registry mutation or authoring file write MUST occur

#### Scenario: Authoring init is registered

- **WHEN** `runCli(["marketplace", "init", "--help"])` or invoking `marketplace init` in a writable temp project with required flags for a successful scaffold path is attempted
- **THEN** the CLI MUST NOT treat `init` as an unknown marketplace subcommand (exit path MUST be help, validation, or successful scaffold — not “unknown subcommand”)

#### Scenario: Consumer validate remains available

- **WHEN** `runCli(["marketplace", "validate", "NAME"])` is invoked for a registered marketplace
- **THEN** the command MUST still run the existing consumer validate workflow (not authoring schema check of cwd `bapm.yml`)
