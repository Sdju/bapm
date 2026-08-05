## ADDED Requirements

### Requirement: deps why accepts --json
The `deps` command MUST accept `--json` on the `why` subcommand. When set, CLI MUST request machine-readable why output from core and MUST write success JSON to stdout and error JSON to stderr per `deps-inspect`. Unknown flags on `deps` (including `--json` on subcommands that do not support it) MUST hard-error with non-zero exit. Help for `deps` MUST document `why --json`.

#### Scenario: why --json is recognized
- **WHEN** `runCli(["deps", "why", "pkg", "--json"])` is invoked against a fixture where why can succeed or fail per deps-inspect
- **THEN** the CLI MUST NOT treat `--json` as an unknown flag and MUST apply deps-inspect JSON stream/exit rules

#### Scenario: --json on list fails closed
- **WHEN** `runCli(["deps", "list", "--json"])` is invoked
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown or unsupported flag

### Requirement: deps clean subcommand is registered
Invoking `deps clean` MUST be recognized (not an unknown subcommand). It MUST accept `-y` / `--yes` and MUST delegate to the same modules-cache clean path as `cache clean` (core `cacheClean` / equivalent). Help MUST document `deps clean` and MUST state equivalence to modules wipe / `cache clean` (not APM shared git/http cache). Unknown flags MUST hard-error.

#### Scenario: deps clean is not unknown
- **WHEN** `runCli(["deps", "clean", "-y"])` is called
- **THEN** the CLI MUST NOT treat `clean` as an unknown deps subcommand

#### Scenario: deps help mentions json and clean
- **WHEN** deps help is printed (`deps --help` or equivalent)
- **THEN** stdout MUST mention `--json` (for why) and MUST mention `clean` with modules-wipe / `cache clean` equivalence

## MODIFIED Requirements

### Requirement: deps subcommands list and tree are runnable
Invoking `deps list` and `deps tree` MUST be recognized and MUST exit according to the `deps-inspect` capability. `deps why` MUST be registered. `deps clean` MUST be registered per the added clean requirement. Unknown deps subcommands and unknown flags MUST hard-error with non-zero exit.

#### Scenario: deps list is not unknown
- **WHEN** `runCli(["deps", "list"])` is called against a project with a lock
- **THEN** the CLI MUST NOT treat `deps` or `list` as an unknown command path

#### Scenario: deps why is not unknown
- **WHEN** `runCli(["deps", "why", "pkg"])` is called against a project with a lock
- **THEN** the CLI MUST NOT treat `why` as an unknown deps subcommand
