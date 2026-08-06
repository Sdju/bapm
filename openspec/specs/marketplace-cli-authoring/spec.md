# marketplace-cli-authoring Specification

## Purpose

Defines the FEOD CLI authoring surface under `bapm marketplace` for scaffolding
and maintaining project `marketplace:` configuration: init, package CRUD, check
(with offline mode), optional thin migrate, and Authoring help — without pack
emit or multi-host AuthResolver.

## Requirements

### Requirement: marketplace init scaffolds authoring block
`bapm marketplace init` MUST write a `marketplace:` block into cwd `bapm.yml`. If `bapm.yml` is missing, init MUST create a minimal stub `bapm.yml` (with project name from `--name` when provided). If a `marketplace:` block already exists, init MUST require `--force` to overwrite. Flags `--owner` (default e.g. `acme-org`) and `--name` MUST be accepted. Init MUST NOT emit host marketplace.json artifacts. Success output MAY mention future pack / next steps as text only.

#### Scenario: Init creates marketplace block
- **WHEN** `runCli(["marketplace", "init", "--owner", "acme-org"])` runs in a directory without `marketplace:`
- **THEN** exit code MUST be `0` and `bapm.yml` MUST contain a `marketplace:` mapping with `owner: acme-org` (or equivalent)

#### Scenario: Init without force refuses existing block
- **WHEN** `marketplace:` already exists and init is invoked without `--force`
- **THEN** exit code MUST be non-zero and the existing block MUST remain unchanged

#### Scenario: Init creates stub bapm.yml when missing
- **WHEN** cwd has no `bapm.yml` and init runs with `--name my-mp`
- **THEN** exit code MUST be `0` and a new `bapm.yml` MUST exist containing project identity and `marketplace:`

### Requirement: marketplace package add set remove
`bapm marketplace package` MUST support nested verbs `add`, `set`, and `remove` that edit `bapm.yml` via the authoring editor. `add` MUST accept SOURCE forms `owner/repo`, `host.tld/owner/repo`, and `https://…`, plus flags `--name`, `--version`, `--ref`, `--subdir`, `--tag-pattern`, `--tags`, `--include-prerelease`, and `--no-verify`. `--version` and `--ref` MUST be mutually exclusive. Unless `--no-verify` is set, `add` SHOULD verify remote github-style sources with `git ls-remote` when network is available. `remove` MUST require `-y`/`--yes` in non-interactive sessions. After mutation, the command MUST re-validate; failure MUST yield non-zero exit.

#### Scenario: package add writes entry
- **WHEN** `runCli(["marketplace", "package", "add", "acme/tools", "--name", "tools", "--ref", "main", "--no-verify"])` runs against a project with `marketplace:`
- **THEN** exit code MUST be `0` and `bapm.yml` MUST list package `tools` with source `acme/tools`

#### Scenario: package add rejects both version and ref
- **WHEN** add is invoked with both `--version` and `--ref`
- **THEN** exit code MUST be non-zero and no package entry MUST be written

#### Scenario: package remove without -y fails non-interactive
- **WHEN** `runCli(["marketplace", "package", "remove", "tools"])` runs non-interactively without `-y`
- **THEN** exit code MUST be non-zero and the package MUST remain

### Requirement: marketplace check with offline mode
`bapm marketplace check` MUST load the authoring config and validate schema. With `--offline`, check MUST NOT perform network reachability probes (schema-only, or schema plus cached refs if a cache exists). Without `--offline`, check MUST attempt online reachability for default-host github `owner/repo` entries via thin ambient `git ls-remote`. Local `./` entries MUST be schema-only. For non-github remote forms (`host.tld/…`, gitlab HTTPS, etc.) without hosts-auth support, check MUST NOT hard-require AuthResolver; it MUST either emit a clear unsupported-online-check warning and continue schema validation, or treat those entries as schema-only with an explicit message — and MUST document the chosen behavior in help or error text. Any schema or failed required probe MUST yield non-zero exit (exit semantics SHOULD mirror APM-like missing=1 / validation=2 when practical).

#### Scenario: check --offline passes valid config
- **WHEN** `runCli(["marketplace", "check", "--offline"])` runs against a valid `marketplace:` with a local or unverified remote entry
- **THEN** exit code MUST be `0` and no network probe MUST be required for success

#### Scenario: check fails on invalid schema
- **WHEN** check runs against a `marketplace:` block with an invalid source
- **THEN** exit code MUST be non-zero

#### Scenario: online check probes github shorthand
- **WHEN** check runs without `--offline` against a package with source `owner/repo` on the default github host
- **THEN** the command MUST attempt `git ls-remote` (or equivalent thin probe) for that entry before reporting success

### Requirement: Authoring help section
Marketplace group help and related help text MUST list Authoring subcommands (`init`, `package`, `check`, and `migrate` when shipped) separately from Consumer subcommands. Help MUST NOT claim that pack host marketplace.json emit is unavailable when pack marketplace outputs are shipped. Help MAY direct authors to `bapm pack` for Claude/Codex host artifact emission. Help MUST NOT advertise a restored `marketplace build` verb.

#### Scenario: marketplace help lists Authoring
- **WHEN** `runCli(["marketplace", "help"])` or `runCli(["help", "marketplace"])` (whichever the CLI supports for group help) is invoked
- **THEN** output MUST mention Authoring (or equivalent section) and include `init` and `check`

#### Scenario: Authoring help does not deny pack emit
- **WHEN** marketplace Authoring help is shown after pack marketplace outputs ship
- **THEN** help MUST NOT state that pack host outputs are not shipped

### Requirement: Optional thin marketplace migrate
When shipped in this change, `bapm marketplace migrate` MUST fold standalone `marketplace.yml` into `bapm.yml` `marketplace:`, support `--dry-run` (no write), and require `--force` or `-y`/`--yes` when overwriting an existing block as designed. If migrate is deferred, the CLI MUST NOT register a half-implemented stub that claims success.

#### Scenario: migrate dry-run does not write
- **WHEN** migrate `--dry-run` runs with a legacy `marketplace.yml` present
- **THEN** exit code MUST be `0` on a valid plan and `bapm.yml` MUST NOT gain a new `marketplace:` write from that dry-run
