## Purpose

Defines the thin `bapm lock` CLI surface that invokes `@bapm/core` `resolveAndLock` for drop-in ergonomics without target deploy, registry HTTP, or a separate update product command.

## ADDED Requirements

### Requirement: lock command invokes core resolveAndLock

Invoking `lock` MUST discover and parse the project manifest in the current working directory (dual-read `apm.yml` | `bapm.yml`, no parent walk), run core resolve + download + lock write, and MUST NOT deploy primitives to agent harness directories. On success it MUST exit `0` and indicate that the lockfile was written. On missing manifest or resolve/download/lock failure it MUST exit non-zero.

#### Scenario: Happy path writes lockfile

- **WHEN** `runCli(["lock"])` is invoked in a project with a valid manifest and resolvable deps (including mocked downloaders in tests)
- **THEN** the exit code MUST be `0`, a lockfile MUST exist on disk per M2 write rules, and stdout MUST indicate success

#### Scenario: Missing manifest fails

- **WHEN** `runCli(["lock"])` is invoked in a directory with neither `apm.yml` nor `bapm.yml`
- **THEN** the exit code MUST be non-zero and the error MUST indicate a missing manifest

### Requirement: lock supports update verbose and parallel-downloads flags

The `lock` command MUST accept `--update` (force re-resolve of refs), `--verbose` / `-v`, and `--parallel-downloads` (default parallel download concurrency aligned with APM default 4 unless overridden). Unimplemented APM flags (`--global`, `--no-policy`, `--target`, `lock export`) MUST NOT be required in M3.

#### Scenario: --update forces re-resolve

- **WHEN** `runCli(["lock", "--update"])` is invoked
- **THEN** core MUST run in update mode so pins can move to newer satisfying refs

#### Scenario: parallel-downloads flag accepted

- **WHEN** `runCli(["lock", "--parallel-downloads", "2"])` is invoked on a valid project
- **THEN** the command MUST accept the flag and pass the concurrency to core download orchestration (or documented equivalent)

### Requirement: lock does not claim install or target deploy

The `lock` command MUST NOT initialize targets, MUST NOT copy packages into harness dirs, and MUST NOT change the product claim that `install` remains a non-deploying stub until a later milestone. If `install` later shares core resolve helpers, it MUST still not deploy targets in M3.

#### Scenario: Harness dirs unchanged after lock

- **WHEN** `lock` succeeds on a fixture project that already contains cursor/agents-style dirs
- **THEN** those dirs MUST NOT gain new deployed primitive files from the lock command
