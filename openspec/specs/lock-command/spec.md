# lock-command Specification

## Purpose

Defines the thin `bapm lock` CLI surface that invokes `@bapm/core` `resolveAndLock` for drop-in ergonomics without target deploy, registry HTTP, or a separate update product command.

## Requirements

### Requirement: lock command invokes core resolveAndLock
Invoking `lock` MUST discover and parse the project manifest in the current working directory (dual-read `apm.yml` | `bapm.yml`, no parent walk), run core resolve + download + lock write, and MUST NOT deploy primitives to agent harness directories. On success it MUST exit `0` and indicate that the lockfile was written. On missing manifest or resolve/download/lock failure it MUST exit non-zero.

#### Scenario: Happy path writes lockfile
- **WHEN** `runCli(["lock"])` is invoked in a project with a valid manifest and resolvable deps (including mocked downloaders in tests)
- **THEN** the exit code MUST be `0`, a lockfile MUST exist on disk per M2 write rules, and stdout MUST indicate success

#### Scenario: Missing manifest fails
- **WHEN** `runCli(["lock"])` is invoked in a directory with neither `apm.yml` nor `bapm.yml`
- **THEN** the exit code MUST be non-zero and the error MUST indicate a missing manifest

### Requirement: lock supports update verbose and parallel-downloads flags
The `lock` command MUST accept `--update` (force re-resolve of refs), `--verbose` / `-v`, and `--parallel-downloads` (default parallel download concurrency aligned with APM default 4 unless overridden). The command MUST also accept `--policy <path>` and `--no-policy` when policy gating is wired (passing them through to core). Unimplemented APM flags (`--global`, `--target`, `lock export`) MUST NOT be required in M8.

#### Scenario: --update forces re-resolve
- **WHEN** `runCli(["lock", "--update"])` is invoked
- **THEN** core MUST run in update mode so pins can move to newer satisfying refs

#### Scenario: parallel-downloads flag accepted
- **WHEN** `runCli(["lock", "--parallel-downloads", "2"])` is invoked on a valid project
- **THEN** the command MUST accept the flag and pass the concurrency to core download orchestration (or documented equivalent)

#### Scenario: lock accepts no-policy escape
- **WHEN** `runCli(["lock", "--no-policy"])` is invoked with a blocking local policy present
- **THEN** the command MUST accept the flag and MUST skip the policy gate

### Requirement: Lock SHOULD gate with policy before download and lock write
When policy gating for lock is enabled (default SHOULD for M8 when cheap), `lock` MUST discover/evaluate policy against the resolve plan and MUST abort on blocking violations before downloading modules and before writing the lockfile. Escape via `--no-policy` / env disable MUST skip the gate. If gating is deferred, documentation for this change MUST state the deferral explicitly.

#### Scenario: Blocking policy prevents lock write
- **WHEN** lock policy gating is active, a blocking deny matches the plan, and no escape is set
- **THEN** lock MUST exit non-zero and MUST NOT write a new lockfile for that plan

### Requirement: lock does not claim install or target deploy
The `lock` command MUST NOT initialize targets, MUST NOT copy packages into harness dirs, and MUST NOT deploy primitives. After M4, `install` MAY deploy via registered targets, but `lock` MUST remain non-deploying and MUST NOT invoke target `materialize`.

#### Scenario: Harness dirs unchanged after lock
- **WHEN** `lock` succeeds on a fixture project that already contains cursor/agents-style dirs
- **THEN** those dirs MUST NOT gain new deployed primitive files from the lock command

#### Scenario: lock does not call target materialize
- **WHEN** `lock` runs in an environment where a target is registered for install e2e
- **THEN** the lock path MUST NOT invoke that target's materialize contract
