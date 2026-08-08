## ADDED Requirements

### Requirement: Parallel remote checks preserve lock order

When checking remote dependencies, outdated MUST honor a concurrency bound `parallelChecks` (CLI default **4** when the flag is omitted). Value **`0` MUST run checks sequentially**. When `parallelChecks > 0` and more than one dependency requires a remote check, outdated MUST run those checks with concurrency ≤ `parallelChecks` (accepting the option while always remaining serial is FORBIDDEN). After concurrent completion, emitted `rows` and human/JSON report order MUST match lock dependency order. Local / non-network skips MAY complete without consuming a remote-check slot but MUST still appear in lock order among all rows. Tip-of-`resolved_ref`, constraint / no-invented-`^`, exit `0` with outdated rows, missing-lock non-zero, and read-only contracts MUST remain unchanged.

#### Scenario: Default concurrency is four

- **WHEN** outdated runs without an explicit parallel-checks value and at least two remote-checkable lock deps exist
- **THEN** remote checks MUST be eligible to run with concurrency up to **4** (not forced serial solely because the flag was omitted)

#### Scenario: Zero means serial

- **WHEN** outdated runs with `parallelChecks` / `--parallel-checks` / `-j` equal to `0` against multiple remote-checkable deps
- **THEN** remote checks MUST run sequentially (no overlapping in-flight remote checks)

#### Scenario: Positive bound is real concurrency

- **WHEN** outdated runs with `parallelChecks` = `2` (or CLI `-j 2`) against three or more injectable remote-check stubs that can observe overlap
- **THEN** at most two remote checks MUST be in flight at once, and at least one overlap MUST be possible (flag MUST NOT be a no-op serial path)

#### Scenario: Rows keep lock order after parallel checks

- **WHEN** multiple remote-checkable deps finish out of submission order under `parallelChecks > 0`
- **THEN** the resulting `rows` array and report MUST list dependencies in the same order as the lockfile dependencies list
