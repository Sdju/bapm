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

### Requirement: Update applies install policy gate on mutating path
When update applies a mutating plan (confirm/`-y`, not `--dry-run`), it MUST apply the same policy discovery/evaluation gate as install before lock rewrite, modules download, and deploy. `--no-policy` / env disable MUST skip the gate. Dry-run MUST remain non-mutating even when policy would block.

#### Scenario: Mutating update blocked by policy
- **WHEN** pending updates exist, a blocking policy denies a planned dep, and update runs with `-y` without escape
- **THEN** update MUST exit non-zero and MUST NOT rewrite the lock or mutate modules/deploy for that plan

#### Scenario: Dry-run ignores durable gate writes
- **WHEN** update runs with `--dry-run` and a blocking policy would deny the plan
- **THEN** lockfile bytes and modules content MUST remain unchanged (plan output MAY still mention policy)

### Requirement: Update plan verbosity gates keep rows
When update prints a human plan (including `--dry-run`), without verbose the printed text MUST omit rows whose action is `keep` (APM-aligned quieter plan). With verbose enabled, keep rows MUST appear using the existing `[=] … keep` form (or equivalent). Internal plan computation MAY still include keep entries. When every planned row is keep (or the printed set is empty after gating), messaging MUST remain honest — MUST NOT claim packages were updated. Verbose MUST NOT change dry-run non-mutation, confirm/`-y`, policy, or lock rewrite semantics.

#### Scenario: Dry-run without verbose hides keep
- **WHEN** update runs with `--dry-run` and without verbose, and the plan includes one or more `keep` entries plus zero or more non-keep entries
- **THEN** printed plan text MUST NOT contain keep/`[=]` lines for unchanged deps, and lock/modules MUST remain unchanged

#### Scenario: Dry-run with verbose shows keep
- **WHEN** update runs with `--dry-run` and verbose enabled, and the plan includes `keep` entries
- **THEN** printed plan text MUST include keep/`[=]` lines for those unchanged deps

#### Scenario: All-keep plan stays honest without verbose
- **WHEN** update runs with `--dry-run` without verbose and every planned entry is `keep`
- **THEN** output MUST indicate no dependency changes (or equivalent honest empty-change messaging) and MUST NOT imply an update was applied

### Requirement: Update accepts parallel downloads option
Update public options MUST accept `parallelDownloads` aligned with install/APM: default **4** when omitted; **0** means serial (no parallelism). The value MUST be forwarded into the resolve/download path used by mutating update. Invalid values MUST be rejected by the CLI layer (non-zero) when supplied via flags. Parallel downloads MUST NOT weaken frozen refusal, policy gate, or dry-run non-mutation.

#### Scenario: Default concurrency when omitted
- **WHEN** mutating update runs without an explicit parallel-downloads value
- **THEN** resolve/download MUST use concurrency **4** (or the documented APM-aligned default)

#### Scenario: Zero means serial
- **WHEN** update is invoked with parallel downloads set to `0` on a path that reaches resolve
- **THEN** the invocation MUST NOT fail as an unknown option and MUST treat downloads as serial
