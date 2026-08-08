## Purpose

Preserves the `bapm` CLI package public API and the existing help, version, install-stub, and unknown-command runtime behavior after the FEOD layout migration.

## ADDED Requirements

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

Invoking `help`, `-h`, `--help`, or omitting the command (default `help`) MUST print usage that lists at least the `help`, `version`, and `install` commands and MUST return exit code `0`.

#### Scenario: help subcommand succeeds

- **WHEN** `runCli(["help"])` is called
- **THEN** stdout MUST include usage text mentioning `help`, `version`, and `install`, and the return code MUST be `0`

#### Scenario: default command is help

- **WHEN** `runCli([])` is called
- **THEN** help usage MUST be printed and the return code MUST be `0`

### Requirement: Install command remains a failing stub

Invoking `install` MUST print an error indicating that install is not implemented yet, MUST mention the expected manifest and lock file names from core, and MUST return exit code `1`.

#### Scenario: install stub fails with expected files

- **WHEN** `runCli(["install"])` is called
- **THEN** stderr MUST indicate that install is not implemented, MUST mention the expected manifest and lock file names, and the return code MUST be `1`

### Requirement: Unknown command fails with help

Invoking an unrecognized command MUST print an error naming that command, MUST print help usage, and MUST return exit code `1`.

#### Scenario: unknown command reports error

- **WHEN** `runCli(["not-a-real-command"])` is called
- **THEN** stderr MUST mention the unknown command, help usage MUST be shown, and the return code MUST be `1`
