## Purpose

Defines the consumer-facing `bapm marketplace` CLI surface for registering,
listing, browsing, updating, removing, and thinly validating marketplaces
without search, install, or authoring commands.

## ADDED Requirements

### Requirement: Consumer marketplace command group

The CLI MUST register a top-level `marketplace` command that accepts subcommands `add`, `list`, `browse`, `update`, `remove`, and `validate`. Help for the group and top-level help MUST list `marketplace` as a consumer command. Unknown marketplace subcommands and unknown flags MUST fail closed with non-zero exit and a clear error. Authoring subcommands (`init`, `migrate`, `check`, `outdated`, `audit`, `package`, `build`) and `search` MUST NOT be registered in this change.

#### Scenario: Top-level help mentions marketplace

- **WHEN** `runCli(["help"])` is invoked
- **THEN** stdout MUST mention `marketplace` and the exit code MUST be `0`

#### Scenario: Unknown marketplace subcommand fails closed

- **WHEN** `runCli(["marketplace", "init"])` (or any unregistered subcommand) is invoked
- **THEN** the exit code MUST be non-zero and no registry mutation MUST occur

### Requirement: marketplace add SOURCE

`bapm marketplace add SOURCE` MUST accept SOURCE forms: `OWNER/REPO` shorthand (default host github.com), HTTPS github repository URL, HTTPS URL ending in `/marketplace.json`, and local path or `file://` URI. Flags `--name`, `--ref`, and `--host` (host for shorthand) MUST be accepted; alias/`--name` MUST match `[a-zA-Z0-9._-]+`. Before persisting, add MUST probe-fetch the marketplace (force refresh) and MUST refuse unsupported kinds (non-github remotes that are not direct url/local). On success it MUST write the source into `~/.bapm/marketplaces.json` (replace same name case-insensitively). Combining URL `#ref` with `--ref` MUST fail closed.

#### Scenario: Add local marketplace.json succeeds

- **WHEN** `runCli(["marketplace", "add", "<path-to-dir-or-file>", "--name", "local-mp"])` runs against a valid local fixture
- **THEN** exit code MUST be `0` and `list` MUST subsequently show `local-mp`

#### Scenario: Invalid alias rejected

- **WHEN** add is invoked with `--name` containing characters outside `[a-zA-Z0-9._-]+`
- **THEN** exit code MUST be non-zero and the registry MUST be unchanged

#### Scenario: Unsupported remote host refused at add

- **WHEN** add is given a gitlab.com HTTPS git URL (or other non-v1 host kind)
- **THEN** exit code MUST be non-zero with a clear unsupported-host/kind message and no registry write

### Requirement: marketplace list browse update remove

`list` MUST print registered marketplaces from the local registry (empty registry → clear empty/hint message, exit 0). `browse NAME` MUST fetch the named marketplace (may force refresh) and list its plugins (name and short description at minimum). `update [NAME]` MUST clear cache and refetch; when NAME is omitted it MUST refresh all registered marketplaces. `remove NAME` MUST require confirmation or `-y`/`--yes`; non-interactive sessions without `-y` MUST fail closed; on success it MUST remove the registry entry and clear that source's cache.

#### Scenario: List empty registry

- **WHEN** `runCli(["marketplace", "list"])` runs with no registered marketplaces
- **THEN** exit code MUST be `0` and output MUST indicate none are registered (or how to add)

#### Scenario: Remove without -y in non-interactive mode fails

- **WHEN** `runCli(["marketplace", "remove", "acme"])` runs non-interactively without `-y`
- **THEN** exit code MUST be non-zero and the registry entry MUST remain

#### Scenario: Update clears and refetches

- **WHEN** `runCli(["marketplace", "update", "acme"])` runs for a registered cacheable source
- **THEN** the command MUST clear that source's cache and perform a fresh fetch before exit 0 on success

### Requirement: Thin marketplace validate

`bapm marketplace validate NAME` MUST fetch the named marketplace and run schema checks (each plugin has name + source) plus case-insensitive duplicate plugin name detection. Failure of any check MUST yield non-zero exit. Hidden `--check-refs` MUST NOT be required or claimed as supported in this change (explicitly out of scope).

#### Scenario: Validate duplicate names fails

- **WHEN** validate runs against a marketplace whose parsed plugins include two names differing only by case
- **THEN** exit code MUST be non-zero and output MUST mention duplicate names

#### Scenario: Validate schema pass

- **WHEN** validate runs against a well-formed fixture marketplace with unique plugin names and sources
- **THEN** exit code MUST be `0`
