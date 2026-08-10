## ADDED Requirements

### Requirement: Compile help documents polish flags

`bapm compile --help` / `-h` MUST document `-o` / `--output`, `--dry-run`, `-v` / `--verbose`, and `--validate`. Help MUST NOT list `--no-links`, `--target`, `--all`, `-g` / `--global`, `--watch`, `--root`, `--clean`, or `--single-agents` as supported flags in this change. Help MUST NOT claim multi-host optimizer or distributed placement behavior.

#### Scenario: Compile help lists polish flags

- **WHEN** `bapm compile --help` (or `-h`) runs
- **THEN** exit code MUST be `0` and help text MUST mention `-o` or `--output`, `--dry-run`, `-v` or `--verbose`, and `--validate`

#### Scenario: Compile help omits deferred and multi-host flags

- **WHEN** `bapm compile --help` runs
- **THEN** help text MUST NOT advertise `--no-links`, `--target`, `--all`, `--global`, `--watch`, `--root`, `--clean`, or `--single-agents` as available options

## MODIFIED Requirements

### Requirement: Compile command emits AGENTS.md

Invoking `compile` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@b-apm/core` compile orchestration (not a permanent stub). On a valid cursor-oriented fixture it MUST write the configured output file (default `AGENTS.md`) unless `--validate` or `--dry-run` applies, and exit `0` on success. The CLI MUST accept `-o` / `--output`, `--dry-run`, `-v` / `--verbose`, and `--validate` per compile-agents-md. Unknown flags MUST be hard-rejected.

#### Scenario: bapm compile happy path

- **WHEN** `runCli(["compile"])` is invoked in a valid project fixture with discoverable primitives
- **THEN** the exit code MUST be `0` and `AGENTS.md` MUST exist unless `--validate` or `--dry-run` was passed

#### Scenario: compile unknown flag rejected

- **WHEN** `runCli(["compile", "--not-a-real-flag"])` is called
- **THEN** the CLI MUST hard-reject with non-zero exit

#### Scenario: compile dry-run happy path no write

- **WHEN** `runCli(["compile", "--dry-run"])` is invoked in a valid project fixture and `AGENTS.md` is absent
- **THEN** the exit code MUST be `0` and `AGENTS.md` MUST remain absent
