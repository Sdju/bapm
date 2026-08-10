## ADDED Requirements

### Requirement: Install command runs core install happy path

Invoking `install` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@b-apm/core` install orchestration (not a permanent not-implemented stub). On a valid project fixture happy path it MUST exit `0` with modules and lock present; when a cursor target is wired via registration, deploy files MAY be present under registered roots. The command MUST accept basic `--frozen` and mirror core frozen failure/success semantics. CLI/workspace MAY depend on `bapm-target-cursor` for e2e registration without `@b-apm/core` importing that package.

#### Scenario: bapm install happy path

- **WHEN** `runCli(["install"])` is invoked in a valid project fixture with resolvable deps
- **THEN** the exit code MUST be `0`, modules and lock MUST exist, and if cursor is registered deploy files under registered roots MAY be present

#### Scenario: bapm install --frozen mirrors core gate

- **WHEN** `runCli(["install", "--frozen"])` is invoked
- **THEN** behavior MUST match core basic frozen rules (fail before mutation when lock absent or direct pin missing; no lock rewrite on success)

#### Scenario: install is not an unknown command

- **WHEN** `runCli(["install"])` is called
- **THEN** the CLI MUST NOT treat `install` as an unknown command

## MODIFIED Requirements

### Requirement: Help command prints usage

Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, and `lock` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), not a permanent stub disclaimer.

#### Scenario: help subcommand succeeds

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, and `lock`, and the return code MUST be `0`

#### Scenario: default command is help

- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

## REMOVED Requirements

### Requirement: Install command remains a failing stub

**Reason**: M4 un-stubs `install` to call core install orchestration for the happy path and basic `--frozen`.
**Migration**: Use the ADDED requirement "Install command runs core install happy path"; update CLI tests that expected the not-implemented stub.
