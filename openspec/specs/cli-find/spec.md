# cli-find Specification

## Purpose

Defines the top-level consumer CLI command `bapm find PATH` for offline reverse lookup of which locked package(s) deployed a workspace path, with `--source` and `--path` flags and APM-parity exit codes.

## Requirements

### Requirement: Top-level find command

The CLI MUST register a top-level `find` command (not nested under `marketplace`). Invocation MUST accept a single positional `PATH` argument. The command MUST call core offline find orchestration (lock read + reverse index + lookup) and MUST NOT perform network, marketplace, or registry I/O. Flags `--source` and `--path` MUST be accepted. Unknown find flags MUST fail closed with non-zero exit. Help for top-level and `find` MUST list the command and document `PATH`, `--source`, and `--path`.

#### Scenario: Find returns owners for tracked path

- **WHEN** `runCli(["find", "AGENTS.md"])` runs in a project whose lock inventory tracks `AGENTS.md`
- **THEN** exit code MUST be `0` and stdout MUST include at least one owner label line

#### Scenario: Unknown path exits one

- **WHEN** `runCli(["find", "not-tracked.txt"])` runs against a readable lock that does not track that path
- **THEN** exit code MUST be `1`

#### Scenario: Missing lock exits two

- **WHEN** `runCli(["find", "anything"])` runs in a project with no readable lockfile
- **THEN** exit code MUST be `2` and stderr MUST mention `bapm.lock.yaml`

#### Scenario: Source flag appends origin

- **WHEN** `runCli(["find", "AGENTS.md", "--source"])` runs for a tracked dependency-owned path
- **THEN** exit code MUST be `0` and stdout owner line(s) MUST include origin detail beyond the bare label

#### Scenario: Path flag prints why detail

- **WHEN** `runCli(["find", "AGENTS.md", "--path"])` runs for a tracked non-workspace owner with why chains
- **THEN** exit code MUST be `0` and stdout MUST include the owner label plus indented why-chain text

#### Scenario: Unknown find flag fails closed

- **WHEN** `runCli(["find", "AGENTS.md", "--not-a-flag"])` is invoked
- **THEN** exit code MUST be non-zero and the error MUST identify the unknown flag

#### Scenario: Find help documents flags

- **WHEN** `runCli(["find", "--help"])` or `runCli(["find", "-h"])` is invoked
- **THEN** exit code MUST be `0` and help text MUST mention `PATH`, `--source`, and `--path`
