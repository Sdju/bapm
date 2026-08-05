## ADDED Requirements

### Requirement: Bare lock unknown flags fail closed
Bare `bapm lock` (resolve+write path, not `lock export`) MUST reject any argv token that starts with `-` and is not a known option. Known options are exactly: `--update`, `--verbose`, `-v`, `--parallel-downloads` (space-separated value or `=` form), `--policy` (space-separated path or `=` form), `--no-policy`, `--help`, `-h`. On an unknown flag the command MUST exit non-zero, MUST emit a clear error that names the flag (wording aligned with install: `Unknown lock flag: <token>`), and MUST NOT invoke resolve/download/lock write for that invocation (no new or changed lockfile attributable to the bad argv). Soft-ignoring unknown `-…` tokens MUST NOT occur. Unimplemented APM options `-g`, `--global`, `-t`, and `--target` MUST be treated as unknown flags (MUST NOT be implemented in this change). Help for bare lock MUST continue to list only the known options and MUST NOT advertise `--global` / `--target`.

#### Scenario: Unknown bare-lock flag fails without lock write
- **WHEN** `runCli(["lock", "--not-a-real-flag"])` is invoked in a project that would otherwise successfully lock
- **THEN** the exit code MUST be non-zero, the error MUST name `--not-a-real-flag`, and the lockfile MUST NOT be newly written or changed by that invocation

#### Scenario: APM-only global and target flags rejected as unknown
- **WHEN** `runCli(["lock", "--global"])` or `runCli(["lock", "-g"])` or `runCli(["lock", "--target", "x"])` or `runCli(["lock", "-t", "x"])` is invoked
- **THEN** the exit code MUST be non-zero and the error MUST name the unknown flag token (no user-scope or multi-target lock behavior)

#### Scenario: Known P6c flags still accepted
- **WHEN** `runCli(["lock", "--update"])` or `runCli(["lock", "-v"])` or `runCli(["lock", "--parallel-downloads", "0"])` or `runCli(["lock", "--policy", "<path>"])` or `runCli(["lock", "--no-policy"])` is invoked on a valid project (subject to existing valued-flag validation)
- **THEN** the CLI MUST NOT treat those tokens as unknown flags and MUST apply existing lock-command semantics for those options

### Requirement: Bare lock unexpected positionals fail closed
Bare `bapm lock` MUST reject non-flag positional arguments that are not part of a known valued option. On an unexpected positional the command MUST exit non-zero with a clear error naming the argument (wording aligned with export: `Unexpected lock argument: <token>`), and MUST NOT invoke resolve/download/lock write for that invocation. The `export` subcommand token remains the group router and is not a bare-lock positional.

#### Scenario: Unexpected bare-lock positional fails without lock write
- **WHEN** `runCli(["lock", "some-positional"])` is invoked (first arg is not `export`)
- **THEN** the exit code MUST be non-zero, the error MUST name `some-positional`, and resolve/write MUST NOT run for that invocation

### Requirement: Bare lock parse errors use stderr
When bare `lock` fails due to argv parse errors (unknown flag, unexpected positional, or missing/invalid valued-flag values), the error text MUST be written to stderr (same channel as install and `lock export` parse failures) in addition to a non-zero exit.

#### Scenario: Unknown flag error appears on stderr
- **WHEN** `runCli(["lock", "--not-a-real-flag"])` fails closed
- **THEN** stderr MUST contain the unknown-flag error text

## MODIFIED Requirements

### Requirement: lock supports update verbose and parallel-downloads flags
The `lock` command MUST accept `--update` (force re-resolve of refs), `--verbose` / `-v`, and `--parallel-downloads` (default parallel download concurrency aligned with APM default 4 unless overridden). Value `0` MUST be accepted and MUST mean serial downloads (APM semantics). The command MUST also accept `--policy <path>` and `--no-policy` when policy gating is wired (passing them through to core). Unimplemented APM flags (`--global`, `--target`, and short forms `-g` / `-t`) MUST be rejected as unknown flags (fail-closed), not implemented. Subcommand `lock export` remains in scope (see export requirement). Unknown bare-lock flags MUST fail closed per the bare-lock unknown-flags requirement.

#### Scenario: --update forces re-resolve
- **WHEN** `runCli(["lock", "--update"])` is invoked
- **THEN** core MUST run in update mode so pins can move to newer satisfying refs

#### Scenario: parallel-downloads flag accepted
- **WHEN** `runCli(["lock", "--parallel-downloads", "2"])` is invoked on a valid project
- **THEN** the command MUST accept the flag and pass the concurrency to core download orchestration (or documented equivalent)

#### Scenario: parallel-downloads 0 means serial
- **WHEN** `runCli(["lock", "--parallel-downloads", "0"])` is invoked on a valid project
- **THEN** the command MUST accept the flag and MUST run downloads serially (concurrency treated as 1)

#### Scenario: lock accepts no-policy escape
- **WHEN** `runCli(["lock", "--no-policy"])` is invoked with a blocking local policy present
- **THEN** the command MUST accept the flag and MUST skip the policy gate

### Requirement: lock export subcommand emits SBOM inventory
The `lock` CLI surface MUST accept subcommand `export` (group-style: bare `lock` remains resolve+write; `lock export` is inventory export). `bapm lock export` MUST load the existing project lockfile (dual-brand discovery), invoke core SBOM export, and write the SBOM JSON to stdout by default or to `--output` / `-o` when provided. Supported `--format` / `-f` values MUST be `cyclonedx` (default) and `spdx`. Optional `--timestamp` MUST pin the SBOM timestamp when supplied. Export MUST NOT resolve, download, rewrite the lock, or deploy. Missing lock MUST exit non-zero with an explanation on stderr and empty stdout. When writing to stdout (no `-o`), the SBOM body MUST be the only stdout content; diagnostics and `-o` success messages MUST go to stderr. Unknown export flags/format MUST fail closed (not soft-ignored). This change MUST NOT weaken export fail-closed behavior.

#### Scenario: Default export writes CycloneDX to stdout
- **WHEN** `runCli(["lock", "export"])` runs in a project with a valid lockfile and no `-o`
- **THEN** the exit code MUST be `0`, stdout MUST be CycloneDX 1.5 JSON only, and the lockfile MUST be unchanged

#### Scenario: SPDX format and output file
- **WHEN** `runCli(["lock", "export", "-f", "spdx", "-o", "sbom.json"])` runs with a valid lock
- **THEN** the exit code MUST be `0`, `sbom.json` MUST contain SPDX 2.3 JSON, and stdout MUST NOT contain the SBOM body

#### Scenario: Missing lock fails with empty stdout
- **WHEN** `runCli(["lock", "export"])` runs in a directory with no lockfile
- **THEN** the exit code MUST be non-zero, stderr MUST explain the missing lock, and stdout MUST be empty

#### Scenario: Export does not mutate lock mtime path content
- **WHEN** `lock export` succeeds
- **THEN** the existing lockfile MUST remain byte-identical (no rewrite)

#### Scenario: Unknown export format fails closed
- **WHEN** `runCli(["lock", "export", "--format", "not-a-format"])` is invoked
- **THEN** the exit code MUST be non-zero and no successful SBOM MUST be written to stdout

#### Scenario: Unknown export flag remains fail-closed
- **WHEN** `runCli(["lock", "export", "--not-a-real-flag"])` is invoked
- **THEN** the exit code MUST be non-zero and the error MUST name the unknown export flag
