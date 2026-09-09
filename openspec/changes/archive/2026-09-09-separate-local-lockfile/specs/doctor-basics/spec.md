## ADDED Requirements

### Requirement: Doctor warns when bapm.local.lock.yaml is git-tracked

When doctor runs in a project that has `bapm.local.lock.yaml` and the project is a git work tree where that file is tracked by git, doctor MUST emit a non-critical warning (or WARN row) guiding the user to untrack it and keep it gitignored. The warning MUST NOT by itself force a non-zero exit when all critical checks pass. Absence of `bapm.local.lock.yaml`, or an untracked present file, MUST NOT fail this check.

#### Scenario: Tracked personal lock warns without failing exit

- **WHEN** doctor runs in a git project where `bapm.local.lock.yaml` is tracked and other critical checks pass
- **THEN** output MUST include a warning about the tracked personal lockfile and the exit code MUST remain `0`

#### Scenario: Untracked personal lock does not warn as tracked

- **WHEN** doctor runs where `bapm.local.lock.yaml` exists but is not tracked by git
- **THEN** doctor MUST NOT report the tracked-personal-lock warning as if the file were indexed
