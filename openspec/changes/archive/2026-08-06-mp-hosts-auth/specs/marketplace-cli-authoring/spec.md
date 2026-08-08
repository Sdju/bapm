## MODIFIED Requirements

### Requirement: marketplace check with offline mode

`bapm marketplace check` MUST load the authoring config and validate schema. With `--offline`, check MUST NOT perform network reachability probes (schema-only, or schema plus cached refs if a cache exists). Without `--offline`, check MUST attempt online reachability for default-host github `owner/repo` entries via thin ambient `git ls-remote`. Local `./` entries MUST be schema-only. For unlocked non-github remotes (GitHub enterprise, gitlab, ado) when a matching thin env token is available or ambient git can reach the host, check MUST attempt a thin online probe using that class’s credentials or ambient git — MUST NOT hard-require a full AuthResolver. When no token is available and ambient reachability fails or is unsupported, check MUST fail-soft: emit a clear warning (or schema-only message) and continue schema validation without requiring AuthResolver — documented in help or error text. Any schema or failed **required** probe MUST yield non-zero exit (exit semantics SHOULD mirror APM-like missing=1 / validation=2 when practical).

#### Scenario: check --offline passes valid config

- **WHEN** `runCli(["marketplace", "check", "--offline"])` runs against a valid `marketplace:` with a local or unverified remote entry
- **THEN** exit code MUST be `0` and no network probe MUST be required for success

#### Scenario: check fails on invalid schema

- **WHEN** check runs against a `marketplace:` block with an invalid source
- **THEN** exit code MUST be non-zero

#### Scenario: online check probes github shorthand

- **WHEN** check runs without `--offline` against a package with source `owner/repo` on the default github host
- **THEN** the command MUST attempt `git ls-remote` (or equivalent thin probe) for that entry before reporting success

#### Scenario: online check uses thin auth for unlocked gitlab when token present

- **WHEN** check runs without `--offline` against a gitlab HTTPS package source and a GitLab-class env token is set
- **THEN** the command MUST attempt an online probe that can use that token (or ambient git with token-backed env) and MUST NOT refuse solely for “hosts-auth unsupported”
