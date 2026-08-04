## Purpose

Defines basic `bapm doctor` health checks for local tooling and project artifacts so critical environment failures surface with a non-zero exit before lifecycle operations are blamed.

## ADDED Requirements

### Requirement: Doctor checks git on PATH as critical
Doctor MUST verify that `git` is available on PATH. Missing git MUST be reported as a critical failure and MUST cause a non-zero exit.

#### Scenario: Git present passes check
- **WHEN** `git` is on PATH and no other critical checks fail, and doctor runs
- **THEN** the git check MUST pass and the exit code MUST be `0` if no critical failures remain

#### Scenario: Git missing fails doctor
- **WHEN** `git` is not available (mocked absence) and doctor runs
- **THEN** the exit code MUST be non-zero and output MUST report the git check as failed

### Requirement: Doctor checks project artifact sanity
When a project directory is in scope, doctor MUST check that dual-read manifest and/or lock are readable if present (corrupt/unreadable MUST fail closed as critical or clearly reported). Doctor MUST check modules directory sanity (for example expected modules root exists or is creatable / not a blocking file). Marketplace/auth/network deep checks are not required for M6; cursor detect MAY be informational only.

#### Scenario: Readable manifest and lock pass
- **WHEN** doctor runs in a project with valid dual-read manifest and lock
- **THEN** those artifact checks MUST pass (or report OK) provided git is also OK
