## MODIFIED Requirements

### Requirement: Fetch dispatch for github url and local only
`fetchMarketplace` (name flexible) MUST dispatch by derived source kind:
- `github` (github.com and GitHub-class enterprise hosts) MUST retrieve the manifest via the GitHub Contents API using the correct API base for that host (`https://api.github.com` for github.com; `https://{host}/api/v3` for `*.ghe.com` and `GITHUB_HOST` GHES) at the source path or an auto-detected candidate.
- `gitlab` MUST retrieve the manifest via GitLab REST v4 raw-file (or equivalent single-file REST) for the configured path/ref, attaching only GitLab-class env tokens when present.
- `ado` MUST retrieve the manifest via the Azure DevOps Git Items REST API (single-file read) for decomposable org/project/repo URLs, attaching only ADO-class env tokens (`ADO_APM_PAT`) when present. Git-sparse clone MUST NOT be required for the MUST floor when the URL decomposes for REST.
- `url` MUST GET the HTTPS marketplace.json document directly.
- `local` MUST read a direct file or search a directory (and MAY use git show for bare repos when applicable) without requiring a network sidecar cache.
Kind `git` (generic unclassified remotes) MUST be refused with a clear error. Injectable HTTP transport MUST be available for tests.

#### Scenario: Local directory auto-detects candidate path
- **WHEN** fetch runs for a local directory containing `.claude-plugin/marketplace.json` and no higher-priority candidate
- **THEN** fetch MUST succeed using that candidate path among the ordered set `marketplace.json`, `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json`

#### Scenario: Generic git kind refused
- **WHEN** fetch is asked for a source whose derived kind is `git`
- **THEN** fetch MUST fail closed with an error naming the unsupported kind and MUST NOT attempt network I/O for that kind

#### Scenario: Direct url uses empty path
- **WHEN** a `url`-kind source points at `https://example.com/path/marketplace.json`
- **THEN** fetch MUST request that URL and MUST NOT append the three git-backed candidate paths

#### Scenario: Gitlab REST fetch uses gitlab token class
- **WHEN** fetch runs for a gitlab-kind source and only a GitLab-class env token is set
- **THEN** the GitLab REST request MUST include the GitLab auth header form and MUST NOT send GitHub-class Authorization

#### Scenario: Ado Items REST fetch
- **WHEN** fetch runs for an ado-kind source whose URL decomposes to org/project/repo
- **THEN** fetch MUST call the ADO Items REST endpoint for the marketplace path/ref (not require a sparse git clone for success on the happy path)

#### Scenario: GHE uses enterprise api base
- **WHEN** fetch runs for a github-kind source whose host is `corp.ghe.com` (or another `*.ghe.com` / GHES host)
- **THEN** the Contents API request URL MUST use `https://{host}/api/v3/...` and MUST NOT use only `https://api.github.com/...`

### Requirement: Sidecar cache with TTL and force refresh
For `github`, `gitlab`, `ado`, and `url` fetches, the system MUST store parsed JSON under `~/.bapm/cache/marketplace/` as sidecar `.json` + `.meta.json` (or equivalent pair) keyed safely by marketplace identity. Default TTL MUST be approximately 3600 seconds. Within TTL, fetch MUST return cached data unless `forceRefresh` is true. `clearMarketplaceCache` (name flexible) MUST delete sidecars for a source (used by update/remove). Local-kind fetches MUST NOT require sidecar cache. Stale-while-revalidate on network error and conditional ETag/Last-Modified GET are optional SHOULD behaviors; TTL alone is acceptable for v1.

#### Scenario: Cached hit within TTL
- **WHEN** a github, gitlab, ado, or url marketplace was fetched successfully less than one hour ago and force refresh is false
- **THEN** fetch MUST return the cached manifest without requiring a successful network round-trip

#### Scenario: Force refresh bypasses TTL
- **WHEN** fetch is invoked with force refresh true
- **THEN** the system MUST attempt a network (or local) reload and update cache metadata on success for cacheable kinds

#### Scenario: Clear removes sidecar files
- **WHEN** cache clear runs for a registered marketplace name
- **THEN** corresponding cache data and meta files MUST be removed if present

### Requirement: Path auto-detect for git-backed and local dirs
When registering or fetching a github, gitlab, or ado source (or local directory) without a pinned non-default path, the system MUST probe the three candidate paths in priority order and persist/use the first that exists. Direct url sources and direct local files MUST use empty path or the file itself respectively.

#### Scenario: Github add probes candidates then persists path
- **WHEN** `add` probes a github repo where only `.github/plugin/marketplace.json` exists
- **THEN** the registered source path MUST be that candidate (not the default root `marketplace.json` if absent)

#### Scenario: Gitlab auto-detect probes candidates
- **WHEN** fetch runs for a gitlab source without a pinned non-default path
- **THEN** fetch MUST probe the same ordered candidate path set used for github until one exists or all miss

### Requirement: Security floors for url and refs and local paths
Direct `url` fetches MUST use HTTPS only; HTTP URLs and redirects that land on HTTP MUST be rejected. Response body size MUST be bounded at approximately 10 MiB with a clear error on overflow for url, github, gitlab, and ado downloads. Git refs used in fetch MUST match a safe pattern (letters, digits, `.`, `_`, `/`, `-`; no leading `-`, no shell metacharacters). Local fetches MUST reject path-traversal segments in user-supplied path components. For github-class Contents API requests, the system MUST attach Authorization only from GitHub-class env tokens when set. For gitlab and ado REST requests, Authorization (or PRIVATE-TOKEN / Basic as required by that API) MUST come only from the matching class resolver. Url-kind fetches MUST NOT attach marketplace host tokens. If any future path attaches Auth on redirects, cross-class Location targets MUST drop Auth (preparation for sc-003; not claimed as conformance here). Token values MUST never be logged.

#### Scenario: HTTP marketplace.json URL rejected
- **WHEN** a caller fetches a `url`-kind source with an `http://` scheme
- **THEN** fetch MUST fail closed before downloading the body

#### Scenario: Oversized body rejected
- **WHEN** a url, github, gitlab, or ado download would exceed the ~10 MiB bound
- **THEN** fetch MUST fail closed with a size-limit error

#### Scenario: Unsafe ref rejected
- **WHEN** a source ref contains spaces, a leading `-`, or shell metacharacters
- **THEN** fetch MUST fail closed with an invalid-ref error

#### Scenario: Cross-class github token not sent to gitlab fetch
- **WHEN** fetch runs for a gitlab source while only `GITHUB_TOKEN`/`GH_TOKEN` is set
- **THEN** the outgoing GitLab request MUST omit GitHub Authorization headers
