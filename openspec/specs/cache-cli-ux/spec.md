# cache-cli-ux Specification

## Purpose

Defines thin `bapm cache` UX over the modules-cache root: `info` reports root and size/entry stats, and `clean` removes cache content with confirm/`-y`, without breaking resolve identity isolation (rs-016).

## Requirements

### Requirement: Cache info shows modules-cache root and stats

`bapm cache info` MUST print the modules-cache root in use (project `apm_modules` or the documented cache root) and MUST show size and/or entry counts, including zero/empty stats when the cache is empty.

#### Scenario: Info after resolve with modules

- **WHEN** resolve/install has populated modules and `bapm cache info` runs
- **THEN** stdout MUST identify the cache root and report non-zero or empty stats without error

#### Scenario: Info on empty cache

- **WHEN** `bapm cache info` runs with an empty or absent cache directory
- **THEN** the command MUST succeed with a clear empty/zero report (or documented absent root) and MUST NOT crash

### Requirement: Cache clean removes content with confirm

`bapm cache clean` MUST remove modules-cache content for the documented root. Without `-y` / yes flag, the command MUST require confirmation (or refuse to delete) unless dry-run preview is requested. With `-y`, it MUST proceed non-interactively. After clean, subsequent lock/install MUST still be correct after re-resolve (no corrupt lock identity). Dry-run MUST NOT delete.

#### Scenario: Clean with yes removes entries

- **WHEN** `bapm cache clean -y` runs against a populated modules cache
- **THEN** cache entries under that root MUST be removed

#### Scenario: Clean without yes does not silent-delete

- **WHEN** `bapm cache clean` runs without `-y` in a non-interactive context without confirmation
- **THEN** the command MUST NOT silently delete the entire cache

#### Scenario: Dry-run does not require yes

- **WHEN** modules wipe is invoked in dry-run mode without `-y`
- **THEN** the operation MUST NOT refuse solely for lack of yes and MUST NOT delete

### Requirement: Cache clean dry-run preview

Core modules wipe (`cacheClean` / equivalent) MUST accept a dry-run mode that reports would-remove entry count and/or names under the modules-cache root without deleting. When dry-run is set, confirmation/`-y` MUST NOT be required. An absent root MUST succeed as already clean (would-remove 0). `bapm cache clean --dry-run` MAY expose the same core path for symmetry with `deps clean --dry-run`; if the CLI flag is not wired, core MUST still support dry-run for deps consumers.

#### Scenario: dry-run leaves cache intact

- **WHEN** `cacheClean` (or `bapm cache clean --dry-run` if wired) runs with dry-run against a populated modules cache
- **THEN** cache entries MUST remain and the result MUST indicate a successful preview with a positive would-remove count or listed names when entries exist

#### Scenario: dry-run absent root

- **WHEN** dry-run clean runs and the modules-cache root is absent
- **THEN** the result MUST succeed without deletion and report would-remove 0 / already clean

### Requirement: Cache UX preserves rs-016 identity isolation

Cache info/clean MUST NOT change resolve/install cache key identity rules. Distinct repo identities MUST continue to never share materialization directories (rs-016).

#### Scenario: Distinct identities remain isolated after clean

- **WHEN** two distinct repo identities were cached, clean runs, and both are re-resolved
- **THEN** their materialization directories MUST remain distinct per rs-016

### Requirement: Shared APM git http cache deferred

M9 MUST NOT require implementing APM's shared user-level git+http cache (`cache/git_cache.py`, `http_cache.py`). Project modules-local cache is sufficient for the MUST bar. Optional `bapm cache prune --days N` is SHOULD/later.

#### Scenario: No shared git http cache required

- **WHEN** inspecting M9 deliverables for cache
- **THEN** absence of a separate shared git/http cache implementation MUST NOT fail the M9 MUST bar
