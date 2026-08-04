# lifecycle-update Specification

## Purpose

Defines `bapm update` behavior for re-resolving dependency pins against current manifest constraints (OpenAPM rs-011/rs-012) with lk-010 install-path purge, dry-run, and confirm/`-y` semantics without changing manifest constraint text.

## Requirements

### Requirement: Full update re-resolves every direct dependency
When update runs with no package arguments, the system MUST re-resolve every direct dependency against its current manifest constraint (manifest constraint text MUST remain unchanged), MUST rewrite lock pins to the latest satisfying results, and MUST re-resolve transitive dependencies accordingly (OpenAPM rs-011).

#### Scenario: No-arg update moves direct pins
- **WHEN** a lock has git-semver direct deps and a newer remote tag matches the unchanged manifest constraint, and update runs with confirm/`-y`
- **THEN** lock pins for those directs MUST move to the new highest match, transitives MUST be re-resolved, and manifest constraint strings MUST be unchanged

### Requirement: Scoped update holds other pins
When update is given one or more package names, the system MUST re-resolve only those packages and their subtrees; other direct pins MUST remain identical. Update under a frozen context without an explicit override MUST refuse with a non-zero result (OpenAPM rs-012).

#### Scenario: Named package scopes update
- **WHEN** two directs A and B are locked and update runs with `-y A`
- **THEN** only A (and its subtree) pins MAY change and B's pin MUST remain identical

#### Scenario: Frozen update refused without override
- **WHEN** update is invoked in a frozen install/update context without an explicit override
- **THEN** the invocation MUST fail closed with a non-zero result and MUST NOT rewrite the lock

### Requirement: Git-semver update purges install path before re-download
When an explicit update targets a direct git-semver dependency, the system MUST purge that dependency's install path under the modules directory before re-resolve/download so materialization re-runs even if the resolved tag is unchanged (OpenAPM lk-010).

#### Scenario: Stale install path is purged on update
- **WHEN** a git-semver dep has a resolved tag that is unchanged but its modules install path is stale or missing content, and update `-y` targets that dep
- **THEN** the install path MUST be purged and download/materialize MUST run again for that package

### Requirement: Update supports dry-run and confirm path
Update MUST support `--dry-run` (print plan; no lock/modules mutation) and `-y` / `--yes` (apply without interactive prompt). Without `-y`, when a TTY is available the system SHOULD prompt for confirm (default No). In non-TTY without `-y`, mutating update MUST fail closed when changes would apply.

#### Scenario: Dry-run prints plan without mutation
- **WHEN** pending updates exist and update runs with `--dry-run`
- **THEN** a plan MUST be printed and lockfile bytes and modules content MUST remain unchanged

#### Scenario: Yes flag applies without prompt
- **WHEN** pending updates exist and update runs with `-y` or `--yes`
- **THEN** the plan MUST be applied (resolve + lock rewrite + modules as needed) without requiring interactive input
