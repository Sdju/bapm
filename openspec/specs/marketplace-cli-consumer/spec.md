# marketplace-cli-consumer Specification

## Purpose

Defines the consumer-facing `bapm marketplace` CLI surface for registering,
listing, browsing, updating, removing, and thinly validating marketplaces.
Authoring verbs are defined by `marketplace-cli-authoring`. Top-level `search`
is owned by `cli-search`.

## Requirements

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

### Requirement: marketplace add SOURCE

`bapm marketplace add SOURCE` MUST accept SOURCE forms: `OWNER/REPO` shorthand (default host github.com), HTTPS github / GitHub-enterprise / gitlab / ado repository URLs for unlocked kinds, HTTPS URL ending in `/marketplace.json`, and local path or `file://` URI. Flags `--name`, `--ref`, and `--host` (host for shorthand) MUST be accepted; `--host` MUST accept unlocked hosts including `github.com`, `*.ghe.com`, `GITHUB_HOST` GHES hostnames, gitlab.com / GitLab allowlist hosts, and ADO hostnames. Alias/`--name` MUST match `[a-zA-Z0-9._-]+`. Before persisting, add MUST probe-fetch the marketplace (force refresh) and MUST refuse generic `git` kind and GHES↔GitLab overlap with a clear error. On success it MUST write the source into `~/.bapm/marketplaces.json` (replace same name case-insensitively). Combining URL `#ref` with `--ref` MUST fail closed. Help and error text MUST NOT claim that only github.com remotes are supported.

#### Scenario: Add local marketplace.json succeeds

- **WHEN** `runCli(["marketplace", "add", "<path-to-dir-or-file>", "--name", "local-mp"])` runs against a valid local fixture
- **THEN** exit code MUST be `0` and `list` MUST subsequently show `local-mp`

#### Scenario: Invalid alias rejected

- **WHEN** add is invoked with `--name` containing characters outside `[a-zA-Z0-9._-]+`
- **THEN** exit code MUST be non-zero and the registry MUST be unchanged

#### Scenario: Generic git host refused at add

- **WHEN** add is given an HTTPS git URL whose host classifies as generic `git` (not github/gitlab/ado/enterprise allowlists)
- **THEN** exit code MUST be non-zero with a clear unsupported-host/kind message and no registry write

#### Scenario: Gitlab marketplace add accepted for probe

- **WHEN** add is given a gitlab.com HTTPS repository URL (or shorthand with gitlab `--host`) and the probe transport can return a valid marketplace.json
- **THEN** exit code MUST be `0` on successful probe and the registry MUST contain the new entry

#### Scenario: Enterprise --host accepted

- **WHEN** add is invoked with `OWNER/REPO` and `--host` set to a `*.ghe.com` host or configured `GITHUB_HOST`
- **THEN** the CLI MUST NOT reject solely because the host is not github.com (probe/fetch rules still apply)

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
