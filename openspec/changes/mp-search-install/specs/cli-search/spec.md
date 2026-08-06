## Purpose

Defines the top-level consumer CLI command `bapm search` for querying plugins inside a single registered marketplace using `QUERY@MARKETPLACE` syntax with limit and verbose flags.

## ADDED Requirements

### Requirement: Top-level search command
The CLI MUST register a top-level `search` command (not nested under authoring). Invocation MUST accept a single expression `QUERY@MARKETPLACE`, splitting on the **last** `@`. The command MUST fetch the named marketplace from the `~/.bapm` registry via existing fetch/cache, run manifest search against plugin `name` / `description` / `tags`, and print matching plugin name and description plus an install hint of the form `bapm install NAME@MARKETPLACE`. Flag `--limit` MUST default to `20`. Flag `-v` / `--verbose` MUST be accepted for richer output. Unknown search flags MUST fail closed with non-zero exit. Help for top-level and `search` MUST list the command and document `--limit` / `-v`.

#### Scenario: Search returns matches
- **WHEN** `runCli(["search", "demo@local-mp"])` runs against a registered marketplace containing a matching plugin
- **THEN** exit code MUST be `0` and stdout MUST include the plugin name and an install hint containing `bapm install`

#### Scenario: Empty results exit zero with hint
- **WHEN** search runs with a valid `QUERY@MARKETPLACE` but no plugins match
- **THEN** exit code MUST be `0` and output MUST include a clear empty/no-match hint

#### Scenario: Unknown marketplace fails non-zero
- **WHEN** search targets a marketplace alias not present in the local registry
- **THEN** exit code MUST be non-zero with a clear marketplace-not-found error

#### Scenario: Bad expression fails non-zero
- **WHEN** search is invoked without a last-`@` marketplace suffix (or with an empty query/market part)
- **THEN** exit code MUST be non-zero with a clear usage/expression error

#### Scenario: Unknown search flag fails closed
- **WHEN** `runCli(["search", "q@m", "--not-a-flag"])` is invoked
- **THEN** exit code MUST be non-zero and the error MUST identify the unknown flag

#### Scenario: Limit defaults to twenty
- **WHEN** search matches more than twenty plugins and `--limit` is omitted
- **THEN** at most twenty results MUST be printed unless a higher `--limit` is supplied
