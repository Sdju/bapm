## ADDED Requirements

### Requirement: audit supports --format and --output

The `audit` command MUST accept `--format` / `-f` with values `text`, `json`, or `sarif` (default `text` when neither `-f` nor extension auto-detect applies) and `--output` / `-o <path>` to write the report body to a file. Unknown `--format` values MUST hard-error with non-zero exit and MUST NOT write a report file. Help for `audit` MUST document `bapm audit --ci` with optional `-f text|json|sarif` and `-o path`. Exit codes MUST remain `0` clean / `1` fail per `audit-integrity` regardless of format. When `-o` is provided and `-f` is omitted, the CLI SHOULD auto-detect format from the path: `.sarif` or `.sarif.json` → `sarif`, `.json` → `json`; other extensions keep `text`. Explicit `-f` MUST win over extension detection. Markdown format MUST NOT be accepted for audit CI in this change (unknown / unsupported → fail-closed).

#### Scenario: -f json is recognized

- **WHEN** `runCli(["audit", "--ci", "-f", "json"])` runs on a clean fixture
- **THEN** the exit code MUST be `0` and stdout MUST be JSON with `passed: true`

#### Scenario: unknown -f fails closed

- **WHEN** `runCli(["audit", "--ci", "-f", "xml"])` is called
- **THEN** the return code MUST be non-zero and no report file MUST be written

#### Scenario: -o with .sarif extension auto-detects when -f omitted

- **WHEN** `runCli(["audit", "--ci", "-o", "out.sarif"])` runs without `-f` on a clean fixture
- **THEN** the file `out.sarif` MUST contain SARIF 2.1 with driver name `bapm-audit` and exit code MUST be `0`

#### Scenario: explicit -f wins over extension

- **WHEN** `runCli(["audit", "--ci", "-f", "json", "-o", "out.sarif"])` runs on a clean fixture
- **THEN** `out.sarif` MUST contain JSON (not SARIF) matching the CIAuditResult shape

#### Scenario: audit help mentions formats

- **WHEN** `runCli(["audit", "--help"])` is called
- **THEN** stdout MUST mention `--ci`, `-f` / `--format` with `text|json|sarif`, and `-o` / `--output`

## MODIFIED Requirements

### Requirement: audit --ci is the CI integrity gate surface

Invoking `audit --ci` MUST run the core audit CI gate and MUST map exit codes 0/1 per `audit-integrity`. Structured formats (`json` / `sarif`) MUST use the same gate outcome as `text` for the same project tree.

#### Scenario: audit --ci is not unknown

- **WHEN** `runCli(["audit", "--ci"])` is called
- **THEN** the CLI MUST NOT treat `audit` as an unknown command and MUST apply CI gate semantics

#### Scenario: format does not flip exit vs text

- **WHEN** the same failing fixture is audited with `-f text` and with `-f json`
- **THEN** both runs MUST exit `1`
