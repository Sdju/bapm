## ADDED Requirements

### Requirement: deps help documents short-form why queries
Deps help MUST document that `deps why` accepts short-form queries: unique basename and unique `owner/repo` derived from lock `repo_url`, in addition to exact `name` / `repo_url`. Examples such as `deps why shared-utils` and `deps why acme-org/shared-utils` MUST appear (or equivalent). Unknown flags MUST remain fail-closed.

#### Scenario: Help mentions basename and owner/repo
- **WHEN** deps help is printed (`deps --help` or equivalent)
- **THEN** stdout MUST mention basename and/or `owner/repo` short-form why usage (examples acceptable)

### Requirement: deps clean accepts --dry-run
The `deps` command MUST accept `--dry-run` on the `clean` subcommand. When set, CLI MUST request a modules-wipe preview from the same core clean path used by `cache clean` / `deps clean` and MUST apply deps-inspect dry-run semantics (no delete; no `-y` required). `--dry-run` on other deps subcommands MUST fail closed. Help MUST document `--dry-run` for clean.

#### Scenario: clean --dry-run is recognized
- **WHEN** `runCli(["deps", "clean", "--dry-run"])` is invoked against a project with or without `apm_modules`
- **THEN** the CLI MUST NOT treat `--dry-run` as an unknown flag and MUST NOT delete modules content

#### Scenario: --dry-run on why fails closed
- **WHEN** `runCli(["deps", "why", "pkg", "--dry-run"])` is invoked
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown or unsupported flag

## MODIFIED Requirements

### Requirement: deps clean subcommand is registered
Invoking `deps clean` MUST be recognized (not an unknown subcommand). It MUST accept `-y` / `--yes` and MUST accept `--dry-run` for a non-deleting modules-wipe preview. It MUST delegate to the same modules-cache clean path as `cache clean` (core `cacheClean` / equivalent). Help MUST document `deps clean`, `--dry-run`, and MUST state equivalence to modules wipe / `cache clean` (not APM shared git/http cache). Unknown flags MUST hard-error.

#### Scenario: deps clean is not unknown
- **WHEN** `runCli(["deps", "clean", "-y"])` is called
- **THEN** the CLI MUST NOT treat `clean` as an unknown deps subcommand

#### Scenario: deps help mentions json and clean
- **WHEN** deps help is printed (`deps --help` or equivalent)
- **THEN** stdout MUST mention `--json` (for why) and MUST mention `clean` with modules-wipe / `cache clean` equivalence

#### Scenario: deps help mentions dry-run
- **WHEN** deps help is printed
- **THEN** stdout MUST mention `--dry-run` for clean
