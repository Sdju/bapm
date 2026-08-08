## ADDED Requirements

### Requirement: Update applies install policy gate on mutating path

When update applies a mutating plan (confirm/`-y`, not `--dry-run`), it MUST apply the same policy discovery/evaluation gate as install before lock rewrite, modules download, and deploy. `--no-policy` / env disable MUST skip the gate. Dry-run MUST remain non-mutating even when policy would block.

#### Scenario: Mutating update blocked by policy

- **WHEN** pending updates exist, a blocking policy denies a planned dep, and update runs with `-y` without escape
- **THEN** update MUST exit non-zero and MUST NOT rewrite the lock or mutate modules/deploy for that plan

#### Scenario: Dry-run ignores durable gate writes

- **WHEN** update runs with `--dry-run` and a blocking policy would deny the plan
- **THEN** lockfile bytes and modules content MUST remain unchanged (plan output MAY still mention policy)
