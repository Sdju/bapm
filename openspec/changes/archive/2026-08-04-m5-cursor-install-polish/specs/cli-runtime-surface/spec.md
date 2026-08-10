## ADDED Requirements

### Requirement: Install unknown flags hard-error

The install command MUST reject unrecognized flags with a non-zero exit code and a clear error message naming the unknown flag. Soft-ignoring unknown flags MUST NOT occur.

#### Scenario: Unknown install flag fails

- **WHEN** `runCli(["install", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: Install help documents supported flag subset

Invoking install help (`bapm install --help`, `bapm help install`, or the documented equivalent) MUST describe real install behavior and MUST document the supported flag subset for this change (at least `--frozen`, and `--target` when implemented). Help MUST NOT describe install as a permanent stub.

#### Scenario: Install help lists frozen and is not stub

- **WHEN** install help is requested
- **THEN** stdout MUST mention install behavior and `--frozen`, MUST NOT say install is a stub, and when `--target` is supported MUST document it

### Requirement: Install supports target flag with clear rejection

The install command MUST accept `--target <id>` (or an equivalent documented form). When `<id>` is `cursor` and cursor is registered, install MUST pass forced-target activation into core. When `<id>` is unknown/unregistered, install MUST fail with a clear error.

#### Scenario: Target cursor forces activation

- **WHEN** `runCli(["install", "--target", "cursor"])` runs in a valid fixture with cursor registered
- **THEN** core install MUST receive forced target `cursor` and the process MUST follow forced-target deploy rules from `install-pipeline`

#### Scenario: Unknown target id rejected

- **WHEN** `runCli(["install", "--target", "not-a-host"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST clearly reject the unknown target

## MODIFIED Requirements

### Requirement: Help command prints usage

Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, and `lock` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), not a permanent stub disclaimer, and MUST be consistent with the install-help requirement for the supported flag subset.

#### Scenario: help subcommand succeeds

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, and `lock`, and the return code MUST be `0`

#### Scenario: default command is help

- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

### Requirement: Install command runs core install happy path

Invoking `install` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@b-apm/core` install orchestration (not a permanent not-implemented stub). On a valid project fixture happy path it MUST exit `0` with modules and lock present; when a cursor target is wired via registration and detect/force applies, deploy files under registered roots MAY/MUST appear per cursor and install-pipeline specs. The command MUST accept `--frozen` and mirror core frozen failure/success semantics including deployed-hash re-verify when hashes exist. The command MUST hard-reject unknown flags and MUST reject `--frozen` combined with mutation flags such as `--update` when exposed. CLI/workspace MAY depend on `bapm-target-cursor` for registration without `@b-apm/core` importing that package.

#### Scenario: bapm install happy path

- **WHEN** `runCli(["install"])` is invoked in a valid project fixture with resolvable deps
- **THEN** the exit code MUST be `0`, modules and lock MUST exist, and if cursor is registered and active deploy files under registered roots MAY be present

#### Scenario: bapm install --frozen mirrors core gate

- **WHEN** `runCli(["install", "--frozen"])` is invoked
- **THEN** behavior MUST match core frozen rules (fail before mutation when lock absent or direct pin missing; no lock rewrite on success; re-verify `deployed_file_hashes` when present)

#### Scenario: install is not an unknown command

- **WHEN** `runCli(["install"])` is called
- **THEN** the CLI MUST NOT treat `install` as an unknown command

#### Scenario: frozen plus update rejected at CLI

- **WHEN** `runCli(["install", "--frozen", "--update"])` is called
- **THEN** the return code MUST be non-zero and no install mutation MUST occur
