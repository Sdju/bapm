## ADDED Requirements

### Requirement: Install exposes force insecure dev and only flags

The install command MUST accept `--force`, `--allow-insecure`, repeatable `--allow-insecure-host <hostname>`, `--dev`, and `--only <apm|mcp>`. Parsed values MUST be forwarded to `@bapm/core` install options. `--only` values other than `apm` or `mcp` MUST fail closed with a clear usage error. Invalid `--allow-insecure-host` hostnames MUST fail closed at parse. Unknown flags remain hard errors. Help MUST document these flags and MUST state that `--force` does not refresh refs and does not bypass frozen or policy. Help MUST NOT document `--refresh` in this change (deferred). Help MUST NOT conflate `--force` with `--target` / forced-target activation.

#### Scenario: New project-scope flags accepted

- **WHEN** `runCli(["install", "--force", "--allow-insecure", "--allow-insecure-host", "mirror.example.com", "--dev", "--only", "apm"])` is invoked in a valid parse context (flags alone or with a fixture that does not trip unrelated gates)
- **THEN** the CLI MUST NOT treat any of those tokens as unknown flags and MUST forward the corresponding options into core

#### Scenario: Invalid --only value rejected

- **WHEN** `runCli(["install", "--only", "lsp"])` (or any value other than `apm`/`mcp`) is called
- **THEN** the return code MUST be non-zero and no install mutation MUST occur

#### Scenario: Invalid allow-insecure-host rejected

- **WHEN** `runCli(["install", "--allow-insecure-host", "not a host"])` is called with a non-FQDN token
- **THEN** the return code MUST be non-zero before durable install writes

#### Scenario: Install help lists p7a flags

- **WHEN** install help is requested
- **THEN** stdout MUST mention `--force`, `--allow-insecure`, `--allow-insecure-host`, `--dev`, and `--only`, MUST note that `--force` does not refresh refs / bypass frozen or policy, and MUST NOT claim `--refresh` support

### Requirement: Install --dev positional uses CLI wiring

When install is invoked with `--dev` and positional package-ref add, the CLI MUST pass the dev flag so core writes `devDependencies.apm` per install-pipeline. Combining `--dev` with archive `.zip` positional MUST follow existing zip-vs-ref disambiguation (zip path is not a package-ref add).

#### Scenario: bapm install pkg --dev reaches core

- **WHEN** `runCli(["install", "owner/repo", "--dev"])` runs non-frozen without dry-run on a writable fixture
- **THEN** core install MUST receive the package ref and the dev flag so the add targets `devDependencies.apm`
