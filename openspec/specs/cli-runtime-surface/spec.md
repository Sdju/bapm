# cli-runtime-surface Specification

## Purpose

Preserves the `bapm` CLI package public API and the existing help, version, install-stub, and unknown-command runtime behavior after the FEOD layout migration.

## Requirements

### Requirement: Public runCli export remains available
The `bapm` package MUST continue to export an async `runCli(argv: string[]) => Promise<number>` from its package root entry so programmatic callers and tests can invoke the CLI without spawning the binary.

#### Scenario: Package root re-exports runCli
- **WHEN** a consumer imports `runCli` from the package root entry (`src/index.ts` / built `dist/index`)
- **THEN** the import MUST resolve to the same CLI dispatch function used by the binary entry

### Requirement: Pack entries for index and cli remain
The package build MUST keep pack entry points for the library index and the CLI binary (currently `src/index.ts` and `src/cli.ts`, producing the configured `exports` / `bin` targets). Those files MAY become thin re-exports into `app`, but the entry paths used by `vp pack` MUST remain valid.

#### Scenario: Binary entry still boots the CLI
- **WHEN** the CLI binary entry is executed
- **THEN** it MUST invoke `runCli` with `process.argv` without the node executable and script path, and set the process exit code from the returned number

### Requirement: Version command prints name and version
Invoking `version`, `-V`, or `--version` MUST print a single line containing the product name and version (sourced from `@bapm/core`) and MUST return exit code `0`.

#### Scenario: version subcommand succeeds
- **WHEN** `runCli(["version"])` is called
- **THEN** stdout MUST include a line matching the product name followed by a version, and the return code MUST be `0`

#### Scenario: version short flag succeeds
- **WHEN** `runCli(["-V"])` is called
- **THEN** the return code MUST be `0` and stdout MUST include the product name and version

### Requirement: Help command prints usage
Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, `install`, and `lock` commands and MUST return exit code `0`. Help text for `install` MUST describe real install behavior (agentic dependency install), not a permanent stub disclaimer.

#### Scenario: help subcommand succeeds
- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, `install`, and `lock`, and the return code MUST be `0`

#### Scenario: default command is help
- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

### Requirement: Install command runs core install happy path
Invoking `install` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@bapm/core` install orchestration (not a permanent not-implemented stub). On a valid project fixture happy path it MUST exit `0` with modules and lock present; when a cursor target is wired via registration, deploy files MAY be present under registered roots. The command MUST accept basic `--frozen` and mirror core frozen failure/success semantics. CLI/workspace MAY depend on `bapm-target-cursor` for e2e registration without `@bapm/core` importing that package.

#### Scenario: bapm install happy path
- **WHEN** `runCli(["install"])` is invoked in a valid project fixture with resolvable deps
- **THEN** the exit code MUST be `0`, modules and lock MUST exist, and if cursor is registered deploy files under registered roots MAY be present

#### Scenario: bapm install --frozen mirrors core gate
- **WHEN** `runCli(["install", "--frozen"])` is invoked
- **THEN** behavior MUST match core basic frozen rules (fail before mutation when lock absent or direct pin missing; no lock rewrite on success)

#### Scenario: install is not an unknown command
- **WHEN** `runCli(["install"])` is called
- **THEN** the CLI MUST NOT treat `install` as an unknown command

### Requirement: Unknown command fails with help
Invoking an unrecognized command MUST print an error naming that command, MUST print help usage, and MUST return exit code `1`.

#### Scenario: unknown command reports error
- **WHEN** `runCli(["not-a-real-command"])` is called
- **THEN** stderr MUST mention the unknown command, help usage MUST be shown, and the return code MUST be `1`

### Requirement: Lock command is registered and runnable
Invoking `lock` MUST be recognized by CLI dispatch and MUST invoke the lock command handler (thin FEOD command → module → `@bapm/core` `resolveAndLock`). Success and failure exit codes MUST follow the `lock-command` capability.

#### Scenario: lock subcommand is not unknown
- **WHEN** `runCli(["lock"])` is called
- **THEN** the CLI MUST NOT treat `lock` as an unknown command
