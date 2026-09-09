## ADDED Requirements

### Requirement: Personal lock is outside brand dual-conflict matrix

Shared lock discovery (`apm.lock.yaml` / `bapm.lock.yaml` dual-read, explicit path, fresh default `bapm.lock.yaml`) MUST remain unchanged. Presence of `bapm.local.lock.yaml` MUST NOT participate in the shared dual-conflict matrix: having both brand shared locks is still a hard error; having exactly one shared brand lock plus `bapm.local.lock.yaml` MUST NOT be treated as a dual-conflict. Explicit shared-lock path options MUST NOT silently redirect to the personal lockfile.

#### Scenario: Shared plus personal is not dual-conflict

- **WHEN** the project root contains `bapm.lock.yaml` and `bapm.local.lock.yaml` (and not `apm.lock.yaml`)
- **THEN** shared discovery MUST resolve `bapm.lock.yaml` successfully and MUST NOT raise `LOCKFILE_DUAL_CONFLICT` solely because the personal lock exists

#### Scenario: Both shared brands still conflict

- **WHEN** the project root contains both `apm.lock.yaml` and `bapm.lock.yaml` regardless of `bapm.local.lock.yaml`
- **THEN** shared discovery MUST still fail with a hard dual-conflict error naming the two shared brand paths
