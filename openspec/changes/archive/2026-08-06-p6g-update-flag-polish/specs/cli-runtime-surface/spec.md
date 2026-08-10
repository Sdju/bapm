## ADDED Requirements

### Requirement: Update exposes verbose and parallel-downloads flags

The `update` command MUST accept `-v` / `--verbose` and `--parallel-downloads <n>` (and `--parallel-downloads=<n>`). Verbose MUST enable keep-row plan printing per `lifecycle-update`. `--parallel-downloads` MUST parse a non-negative integer (`0` = serial); when omitted, CLI/core MUST apply default **4**. Invalid or missing values for `--parallel-downloads` MUST fail with non-zero exit and a clear error. Values MUST be forwarded to `@b-apm/core` update. Unknown flags MUST remain hard errors. Help for `update` MUST document `-v`/`--verbose` and `--parallel-downloads` (including that `0` means serial). Existing `-y`/`--yes`, `--dry-run`, package scope, `--policy`/`--no-policy`, and non-TTY requiring `-y` MUST remain unchanged.

#### Scenario: Verbose short flag accepted on update

- **WHEN** `runCli(["update", "-v", "--dry-run"])` (or equivalent) runs in a valid project context
- **THEN** the CLI MUST NOT reject `-v` as unknown

#### Scenario: parallel-downloads zero accepted on update

- **WHEN** `runCli(["update", "--parallel-downloads", "0", "-y"])` or a dry-run path that exercises the flag is invoked
- **THEN** the CLI MUST NOT treat the flag as unknown and MUST pass serial concurrency into core

#### Scenario: Invalid parallel-downloads fails closed

- **WHEN** `runCli(["update", "--parallel-downloads", "nope"])` is called
- **THEN** the return code MUST be non-zero and a clear error MUST name the invalid value

#### Scenario: Update help lists polish flags

- **WHEN** update help is requested (`bapm update --help` or equivalent)
- **THEN** stdout MUST mention `-v`/`--verbose` and `--parallel-downloads` (including serial/`0` semantics)

#### Scenario: Unknown update flag still fails

- **WHEN** `runCli(["update", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and the error MUST name the unknown flag
