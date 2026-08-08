## ADDED Requirements

### Requirement: Doctor warns when bapm.local.yml is git-tracked

When doctor runs in a project that has `bapm.local.yml` and the project is a git work tree where that file is tracked by git, doctor MUST emit a non-critical warning (or WARN row) guiding the user to untrack it and keep it gitignored. The warning MUST NOT by itself force a non-zero exit when all critical checks pass. Absence of `bapm.local.yml`, or an untracked present file, MUST NOT fail this check.

#### Scenario: Tracked local overlay warns without failing exit

- **WHEN** doctor runs in a git project where `bapm.local.yml` is tracked and other critical checks pass
- **THEN** output MUST include a warning about the tracked personal overlay and the exit code MUST remain `0`

#### Scenario: Untracked local overlay does not warn as tracked

- **WHEN** doctor runs where `bapm.local.yml` exists but is not tracked by git
- **THEN** doctor MUST NOT report the tracked-local-overlay failure/warning as if the file were indexed
