# cache-cli-ux Specification

## Purpose

Defines thin `bapm cache` UX over the modules-cache root: `info` reports root and size/entry stats, and `clean` removes cache content with confirm/`-y`, without breaking resolve identity isolation (rs-016). It also exposes an opt-in shared git mirror cache (`BAPM_CACHE_DIR`) with its own info/clean surface, while default clean stays project-modules.

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

### Requirement: Opt-in shared git mirror cache

Shared git caching MUST be off unless `BAPM_CACHE_DIR` is set. When enabled, git downloads MUST ensure a bare mirror at `<BAPM_CACHE_DIR>/git/<sha256(normalized repo url)>.git` (`git clone --mirror` or update equivalent) and MUST materialize the requested commit from that mirror instead of cloning the upstream directly. `BAPM_NO_CACHE=1` MUST disable cache use even when `BAPM_CACHE_DIR` is set. Local `path`, `file://`, and `local:` sources MUST NOT populate the shared cache. Cache failures MUST emit a clear warning and fall back to a direct clone; a failed mirror update MUST reuse an existing mirror when it already contains the requested commit. Existing atomic temp+swap download and idempotent checkout behavior MUST be preserved.

#### Scenario: First install populates a mirror

- **WHEN** `BAPM_CACHE_DIR` is set and a git dependency is downloaded for the first time
- **THEN** a bare mirror for the normalized repo identity MUST exist under `<BAPM_CACHE_DIR>/git/` and the modules checkout MUST contain the requested commit

#### Scenario: Second project reuses the mirror

- **WHEN** another project downloads the same repo identity and commit with the same cache root
- **THEN** the checkout MUST be materialized from the mirror without requiring a direct upstream clone

#### Scenario: No-cache bypass

- **WHEN** `BAPM_NO_CACHE=1` is set with `BAPM_CACHE_DIR`
- **THEN** no shared mirror MUST be created or updated and the download MUST use the direct clone path

#### Scenario: Cache error falls back

- **WHEN** the shared cache root or mirror cannot be created/updated and the requested commit is unavailable there
- **THEN** the downloader MUST warn and fall back to a direct clone rather than failing the install

#### Scenario: Local sources are never cached

- **WHEN** a dependency is a local path, `file://` URL, or `local:` source
- **THEN** the shared cache MUST NOT contain a mirror for it

### Requirement: Shared cache info and clean surface

The cache module MUST expose shared git-cache path/size/mirror info and a clean operation scoped to `<BAPM_CACHE_DIR>/git`. The CLI MUST expose this as `bapm cache info --shared` and `bapm cache clean --shared` (with the same `-y`/`--dry-run` rules). Default `bapm cache info` MAY include shared stats when configured. Default `bapm cache clean` MUST keep project modules-cache semantics and MUST NOT delete shared mirrors or `apm_modules` when `--shared` is used.

#### Scenario: Shared info reports path and size

- **WHEN** `bapm cache info --shared` runs with populated mirrors
- **THEN** output MUST identify the shared git-cache path and report mirror count/size without error

#### Scenario: Shared clean leaves modules

- **WHEN** `bapm cache clean --shared -y` runs
- **THEN** mirrors under `<BAPM_CACHE_DIR>/git` MUST be removed and `apm_modules` MUST be untouched

#### Scenario: Default clean leaves shared cache

- **WHEN** `bapm cache clean -y` runs without `--shared`
- **THEN** project modules-cache entries MUST be removed and shared git mirrors MUST remain

### Requirement: Shared APM git http cache remains optional

M9 MUST NOT require implementing APM's shared user-level **http** cache (`cache/http_cache.py`). Project modules-local cache remains sufficient for the MUST bar; the opt-in shared git mirror cache above is an additive capability. Optional `bapm cache prune --days N` is SHOULD/later.

#### Scenario: No shared http cache required

- **WHEN** inspecting cache deliverables
- **THEN** absence of a separate shared http cache implementation MUST NOT fail the MUST bar
