## ADDED Requirements

### Requirement: outdated accepts verbose flag
The `outdated` command MUST accept `-v` and `--verbose` as equivalent flags enabling richer detail in the report. Help for `outdated` MUST document `-v` / `--verbose` and MUST state that outdated is report-only while `update` remains the mutating refresh command. Unknown flags on `outdated` MUST continue to hard-error with non-zero exit. Exit policy from `lifecycle-outdated` MUST remain unchanged (outdated rows → exit `0`; missing lock → non-zero).

#### Scenario: -v is recognized
- **WHEN** `runCli(["outdated", "-v"])` or `runCli(["outdated", "--verbose"])` runs against a project with a lock
- **THEN** the CLI MUST NOT treat the flag as unknown and MUST exit according to lifecycle-outdated rules

#### Scenario: Unknown outdated flag still fails
- **WHEN** `runCli(["outdated", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

#### Scenario: Help mentions verbose and report-only
- **WHEN** outdated help is requested (`outdated --help` / `-h` or equivalent)
- **THEN** help text MUST mention `-v` / `--verbose` and MUST indicate that outdated does not modify the lock (update does)
