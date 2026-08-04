## ADDED Requirements

### Requirement: Lock SHOULD gate with policy before download and lock write
When policy gating for lock is enabled (default SHOULD for M8 when cheap), `lock` MUST discover/evaluate policy against the resolve plan and MUST abort on blocking violations before downloading modules and before writing the lockfile. Escape via `--no-policy` / env disable MUST skip the gate. If gating is deferred, documentation for this change MUST state the deferral explicitly.

#### Scenario: Blocking policy prevents lock write
- **WHEN** lock policy gating is active, a blocking deny matches the plan, and no escape is set
- **THEN** lock MUST exit non-zero and MUST NOT write a new lockfile for that plan

## MODIFIED Requirements

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
