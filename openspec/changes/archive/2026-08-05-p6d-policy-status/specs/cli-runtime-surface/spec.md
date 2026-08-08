## ADDED Requirements

### Requirement: CLI policy status subcommand

The CLI MUST expose `bapm policy status` as a registered command path under group `policy` with **only** the `status` subcommand in this change (`explain` / approve-deny MUST NOT be added). Top-level help MUST mention `policy`. Status MUST accept `--json`, `--policy <path>`, `--no-policy`, and `--check`. Status MUST NOT expose `--no-cache` unless bapm discovery gains a truthful cache switch (omit rather than invent). Unknown flags MUST fail closed with non-zero exit for parse errors.

#### Scenario: Help lists policy

- **WHEN** top-level help is printed
- **THEN** it MUST mention the `policy` command

#### Scenario: Status help

- **WHEN** `bapm policy status --help` runs
- **THEN** it MUST document `--json`, `--policy`, `--no-policy`, and `--check`

#### Scenario: Unknown flag rejected

- **WHEN** `bapm policy status` is invoked with an unknown flag
- **THEN** the process MUST exit non-zero with an error naming the flag

### Requirement: Status exit contract

Default `bapm policy status` (human or `--json`) MUST exit `0` for found, absent, disabled, dual-conflict diagnostics, and soft discovery/fetch/schema failures. With `--check`, exit MUST be non-zero when no usable policy is available (absent/disabled/unusable/error), and `0` when a usable policy is found.

#### Scenario: Default exit zero when absent

- **WHEN** status runs without `--check` and no policy is found
- **THEN** exit code MUST be `0`

#### Scenario: Default exit zero on soft failure

- **WHEN** status runs without `--check` and discovery/load yields dual-conflict or fetch/schema failure
- **THEN** exit code MUST be `0` and output MUST still report the diagnostic outcome

#### Scenario: Check mode fails when absent

- **WHEN** status runs with `--check` and no usable policy is found
- **THEN** exit code MUST be non-zero

#### Scenario: Explicit policy path

- **WHEN** status runs with `--policy <path>` pointing at a valid policy file
- **THEN** the report MUST use that source and default exit MUST be `0`

#### Scenario: Escape via flag or env

- **WHEN** status runs with `--no-policy` or with `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1`
- **THEN** the report MUST show disabled/escaped posture and default exit MUST be `0` (non-zero only with `--check`)
