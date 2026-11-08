# cache-cli-ux Specification

## Purpose

Defines thin `bapm cache` UX over the modules-cache root: `info` reports root and size/entry stats, and `clean` removes cache content with confirm/`-y`, without breaking resolve identity isolation (rs-016). It also exposes opt-in shared git mirror and HTTP response caches (`BAPM_CACHE_DIR`) with their own info/clean/prune surface, while default clean stays project-modules.

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

The cache module MUST expose shared git-cache and HTTP-cache path/size/entry info and clean operations scoped to `<BAPM_CACHE_DIR>/git` and `<BAPM_CACHE_DIR>/http`. The CLI MUST expose this as `bapm cache info --shared` and `bapm cache clean --shared` (with the same `-y`/`--dry-run` rules). Default `bapm cache info` MAY include shared stats when configured. Default `bapm cache clean` MUST keep project modules-cache semantics and MUST NOT delete shared mirrors/HTTP entries or `apm_modules` when `--shared` is used.

#### Scenario: Shared info reports path and size

- **WHEN** `bapm cache info --shared` runs with populated mirrors and HTTP entries
- **THEN** output MUST identify both shared cache paths and report mirror/entry counts and size without error

#### Scenario: Shared clean leaves modules

- **WHEN** `bapm cache clean --shared -y` runs
- **THEN** mirrors under `<BAPM_CACHE_DIR>/git` and HTTP entries under `<BAPM_CACHE_DIR>/http` MUST be removed and `apm_modules` MUST be untouched

#### Scenario: Default clean leaves shared cache

- **WHEN** `bapm cache clean -y` runs without `--shared`
- **THEN** project modules-cache entries MUST be removed and shared git mirrors/HTTP entries MUST remain

### Requirement: Opt-in shared HTTP response cache

The shared HTTP cache MUST be off unless `BAPM_CACHE_DIR` is set. When enabled, the registry transport MUST cache only idempotent `GET` responses with status `200` at `<BAPM_CACHE_DIR>/http/<sha256(url + canonical request headers)>`. Requests carrying `Authorization` or `Cookie` headers MUST bypass both read and write. `BAPM_NO_CACHE=1` MUST disable all shared-cache use; `BAPM_HTTP_CACHE=0` MUST disable only HTTP caching. `BAPM_HTTP_CACHE_TTL` MUST control freshness in seconds (default 300, nonnegative integer). `POST`/`PUT`/`PATCH`/`DELETE`, `4xx`/`5xx`, and redirect responses MUST NOT be stored. Redirect following MUST remain manual/redirect-safe; a final `200` after redirect MAY be cached under the original URL only when the original request is safe. Cache read/write failures MUST fall back to the network.

#### Scenario: First GET populates and second hits

- **WHEN** two identical anonymous GET 200 requests run with the same `BAPM_CACHE_DIR`
- **THEN** the first MUST perform the network fetch and store the response, and the second MUST return the cached status/headers/body without a network call

#### Scenario: TTL expiry refetches

- **WHEN** a cached entry is older than `BAPM_HTTP_CACHE_TTL`
- **THEN** the next request MUST fetch from the network and replace the entry

#### Scenario: Auth and mutating requests bypass

- **WHEN** a GET carries `Authorization`/`Cookie` or the method is not GET
- **THEN** the shared HTTP cache MUST NOT be read or written

#### Scenario: Failures are not cached

- **WHEN** a GET returns `4xx` or `5xx`
- **THEN** no HTTP cache entry MUST be created and the next request MUST go to the network

#### Scenario: Malformed entry falls back

- **WHEN** a stored HTTP entry cannot be parsed or validated
- **THEN** the request MUST fall back to the network and MUST NOT fail because of the cache

### Requirement: Shared cache prune covers HTTP entries

`bapm cache prune --shared [--days N]` MUST remove shared git mirrors and HTTP cache entries older than the retention window (default 30 days). `--dry-run` MUST list candidates without deleting. Missing `BAPM_CACHE_DIR` MUST be a successful no-op. HTTP entries MUST be pruned independently of git mirrors and MUST never cause project `apm_modules` deletion.

#### Scenario: HTTP entries prune by age

- **WHEN** `bapm cache prune --shared --days 7` runs with old and recent HTTP entries
- **THEN** only entries older than 7 days MUST be removed and recent entries MUST remain

#### Scenario: HTTP prune dry-run

- **WHEN** `bapm cache prune --shared --dry-run` runs with stale HTTP entries
- **THEN** candidates MUST be reported and no HTTP entry MUST be deleted
