## Purpose

Defines fetching and caching of `marketplace.json` for registered sources of
kinds github, url, and local, including path auto-detection, TTL sidecars,
security floors, and fail-closed refusal of unsupported host kinds.

## ADDED Requirements

### Requirement: Fetch dispatch for github url and local only

`fetchMarketplace` (name flexible) MUST dispatch by derived source kind:

- `github` (github.com Contents API or equivalent for public github.com) MUST retrieve the manifest at the source path or auto-detected candidate.
- `url` MUST GET the HTTPS marketplace.json document directly.
- `local` MUST read a direct file or search a directory (and MAY use git show for bare repos when applicable) without requiring a network sidecar cache.
  Kinds `gitlab`, `ado`, and generic `git` MUST be refused with a clear error directing users that those hosts are out of scope for this change. Injectable HTTP transport MUST be available for tests.

#### Scenario: Local directory auto-detects candidate path

- **WHEN** fetch runs for a local directory containing `.claude-plugin/marketplace.json` and no higher-priority candidate
- **THEN** fetch MUST succeed using that candidate path among the ordered set `marketplace.json`, `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json`

#### Scenario: Unsupported kind refused

- **WHEN** fetch is asked for a source whose derived kind is `gitlab`, `ado`, or `git`
- **THEN** fetch MUST fail closed with an error naming the unsupported kind and MUST NOT attempt network I/O for that kind

#### Scenario: Direct url uses empty path

- **WHEN** a `url`-kind source points at `https://example.com/path/marketplace.json`
- **THEN** fetch MUST request that URL and MUST NOT append the three git-backed candidate paths

### Requirement: Sidecar cache with TTL and force refresh

For `github` and `url` fetches, the system MUST store parsed JSON under `~/.bapm/cache/marketplace/` as sidecar `.json` + `.meta.json` (or equivalent pair) keyed safely by marketplace identity. Default TTL MUST be approximately 3600 seconds. Within TTL, fetch MUST return cached data unless `forceRefresh` is true. `clearMarketplaceCache` (name flexible) MUST delete sidecars for a source (used by update/remove). Local-kind fetches MUST NOT require sidecar cache. Stale-while-revalidate on network error and conditional ETag/Last-Modified GET are optional SHOULD behaviors; TTL alone is acceptable for v1.

#### Scenario: Cached hit within TTL

- **WHEN** a github or url marketplace was fetched successfully less than one hour ago and force refresh is false
- **THEN** fetch MUST return the cached manifest without requiring a successful network round-trip

#### Scenario: Force refresh bypasses TTL

- **WHEN** fetch is invoked with force refresh true
- **THEN** the system MUST attempt a network (or local) reload and update cache metadata on success for cacheable kinds

#### Scenario: Clear removes sidecar files

- **WHEN** cache clear runs for a registered marketplace name
- **THEN** corresponding cache data and meta files MUST be removed if present

### Requirement: Path auto-detect for git-backed and local dirs

When registering or fetching a github source (or local directory) without a pinned non-default path, the system MUST probe the three candidate paths in priority order and persist/use the first that exists. Direct url sources and direct local files MUST use empty path or the file itself respectively.

#### Scenario: Github add probes candidates then persists path

- **WHEN** `add` probes a github repo where only `.github/plugin/marketplace.json` exists
- **THEN** the registered source path MUST be that candidate (not the default root `marketplace.json` if absent)

### Requirement: Security floors for url and refs and local paths

Direct `url` fetches MUST use HTTPS only; HTTP URLs and redirects that land on HTTP MUST be rejected. Response body size MUST be bounded at approximately 10 MiB with a clear error on overflow. Git refs used in fetch MUST match a safe pattern (letters, digits, `.`, `_`, `/`, `-`; no leading `-`, no shell metacharacters). Local fetches MUST reject path-traversal segments in user-supplied path components. Optional: send `Authorization: Bearer` from `GITHUB_TOKEN` or `GH_TOKEN` for github.com Contents API when set (values never logged).

#### Scenario: HTTP marketplace.json URL rejected

- **WHEN** a caller fetches a `url`-kind source with an `http://` scheme
- **THEN** fetch MUST fail closed before downloading the body

#### Scenario: Oversized body rejected

- **WHEN** a url or github download would exceed the ~10 MiB bound
- **THEN** fetch MUST fail closed with a size-limit error

#### Scenario: Unsafe ref rejected

- **WHEN** a source ref contains spaces, a leading `-`, or shell metacharacters
- **THEN** fetch MUST fail closed with an invalid-ref error
