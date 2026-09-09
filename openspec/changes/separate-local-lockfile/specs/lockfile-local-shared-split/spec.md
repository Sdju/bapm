## Purpose

First-class separation of the personal/local lockfile (`bapm.local.lock.yaml`) from the shared team lockfile so bapm `local` source WIP does not churn committed pins, while resolve/install still merge both into one effective graph.

## ADDED Requirements

### Requirement: Personal lockfile filename and discovery

The system MUST use the exact basename `bapm.local.lock.yaml` at the same project root used for shared lock discovery (cwd or explicit root; no parent walk-up). Absence of `bapm.local.lock.yaml` MUST be success when no personal-scope lock entries are required. The personal lock MUST use the same lockfile YAML schema as the shared lock (`lockfile-yaml-rw`). The system MUST treat `apm.local.lock.yaml` as unsupported in v1: when that filename is present at the project root, lock load / resolve-write paths that consider personal lock MUST fail closed with a diagnostic naming the unsupported file.

#### Scenario: Missing personal lock is fine without local sources

- **WHEN** the project has a shared lock (or none yet) and no bapm `local` source dependencies, and `bapm.local.lock.yaml` is absent
- **THEN** load/merge MUST succeed without requiring the personal file

#### Scenario: Personal lock loads from project root

- **WHEN** the project root contains a valid `bapm.local.lock.yaml`
- **THEN** consumers that merge locks MUST load it from that root and MUST NOT walk parents for it

#### Scenario: apm.local.lock.yaml refused

- **WHEN** the project root contains `apm.local.lock.yaml`
- **THEN** the operation that would load or write personal lock state MUST fail closed naming `apm.local.lock.yaml`

### Requirement: Partition criterion is bapm local source, not all path-local

Lock entries MUST be classified as **personal-scope** only when they originate from the bapm dependency source discriminator `local` (including default `.agents/local` and custom `local:` paths). Lock entries for OpenAPM `path:` dependencies MUST remain **shared-scope** even though the lock wire field `source` may be `local`. Top-level shared-lock bags named `local_deployed_files` / `local_deployed_file_hashes` MUST remain on the shared lock document and MUST NOT be relocated to the personal lockfile solely because of their names.

#### Scenario: Discriminator local goes to personal lock

- **WHEN** resolve writes a lock graph that includes a dependency declared with source discriminator `local`
- **THEN** that dependency entry MUST appear in `bapm.local.lock.yaml` and MUST NOT remain in the shared team lockfile after a successful write

#### Scenario: OpenAPM path stays shared

- **WHEN** resolve writes a lock graph that includes only an OpenAPM `path:` local package (no `local` discriminator)
- **THEN** that entry MUST be written to the shared lockfile and MUST NOT require creating `bapm.local.lock.yaml`

#### Scenario: Top-level local_deployed bags stay shared

- **WHEN** the shared lock carries top-level `local_deployed_file_hashes` from prior install attribution
- **THEN** lock rewrite MUST keep those bags on the shared document and MUST NOT move them into `bapm.local.lock.yaml`

### Requirement: Effective lock is shared merged with personal

Commands and core APIs that need the full installed graph (install, lock consumers, deps/why/view, audit, find reverse index, frozen checks that validate the whole tree) MUST build an **effective** lock document by merging shared-lock dependencies with personal-lock dependencies. Merge MUST be a union by lock identity (`repo_url` / equivalent). When the same identity (or the same package `name` when both sides declare a name) appears in both files with conflicting entry content, the system MUST fail closed and MUST NOT silently prefer one side. Shared-only or personal-only identities MUST appear in the effective graph.

#### Scenario: Union includes both scopes

- **WHEN** shared lock pins a git package and personal lock pins a `local`-sourced package
- **THEN** effective-graph consumers MUST observe both entries

#### Scenario: Identity conflict fails closed

- **WHEN** both lockfiles contain the same `repo_url` identity with different pin fields
- **THEN** load/merge MUST fail with a diagnostic naming both files and the conflicting identity

### Requirement: Dual write-back partitions on success

On successful lock-writing operations (`resolveAndLock`, install lock write, update rewrite, and equivalent), the system MUST write shared-scope dependencies (and shared top-level inventory bags) to the shared lockfile using existing dual-read write-back rules, and MUST write personal-scope dependencies to `bapm.local.lock.yaml`. When the personal-scope set is empty after resolve, the system MUST NOT leave stale personal-scope dependency entries: it MUST omit creating a new personal lock when none existed, or clear/remove personal dependency entries from an existing personal lock so they do not survive as ghosts. Failure before success MUST NOT present a successful dual write (no claiming success with only one half updated when both halves were required).

#### Scenario: Fresh shared and personal files

- **WHEN** neither lockfile exists and resolve succeeds with both a git dep and a `local` discriminator dep
- **THEN** the system MUST create `bapm.lock.yaml` (or write-back brand rules) for the git dep and `bapm.local.lock.yaml` for the `local` dep

#### Scenario: Empty personal scope does not require personal file

- **WHEN** resolve succeeds with only shared-scope dependencies and no personal lock file exists
- **THEN** the system MUST write only the shared lock and MUST NOT create `bapm.local.lock.yaml`

#### Scenario: Stale personal entries cleared when local sources removed

- **WHEN** `bapm.local.lock.yaml` still lists a personal-scope package but the manifest no longer declares any `local` source that produces it, and resolve/lock succeeds
- **THEN** that entry MUST NOT remain in the personal lock after the write

### Requirement: Migration strips local-sourced entries from shared lock

When a shared lock still contains dependency entries that classify as personal-scope under current partition rules (legacy single-lock layout), the next successful lock-writing resolve MUST move those entries into `bapm.local.lock.yaml` and MUST remove them from the shared lockfile. Read-only commands MUST still merge legacy personal-scope entries found only in the shared lock into the effective graph until that rewrite occurs (so installs keep working), but MUST NOT treat that legacy co-location as the long-term write target.

#### Scenario: Next lock migrates local pins out of shared

- **WHEN** an existing `bapm.lock.yaml` contains a pin for a `local`-sourced package and the user runs a successful `lock` / install resolve
- **THEN** after success that pin MUST be absent from the shared lock and present in `bapm.local.lock.yaml`

#### Scenario: Read before migrate still sees local pin

- **WHEN** a legacy shared lock still holds a personal-scope entry and no personal lock file exists yet
- **THEN** effective-graph load MUST still include that entry until a lock-writing migrate runs

### Requirement: Personal lock stays unpublished and gitignored

The system MUST treat `bapm.local.lock.yaml` as non-publishable personal state: default pack collection MUST omit it; publish archive construction MUST omit it. When lock-writing or resolve/install consumes at least one bapm `local` source (or writes a personal lock), the system MUST ensure the project ignore rules cover `bapm.local.lock.yaml` (append a covering pattern when missing), analogous to local-root gitignore ensure. Presence of an untracked personal lock MUST NOT alone cause pack secret-refuse failure.

#### Scenario: Ignore rule ensured for personal lock

- **WHEN** a successful lock write creates or updates `bapm.local.lock.yaml` and `.gitignore` lacks a covering pattern
- **THEN** the system MUST append a covering ignore entry for `bapm.local.lock.yaml` before claiming success

#### Scenario: Pack omits personal lock

- **WHEN** pack collects files for a project that contains `bapm.local.lock.yaml`
- **THEN** the pack artifact MUST NOT include `bapm.local.lock.yaml`
