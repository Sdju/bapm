## ADDED Requirements

### Requirement: deps why short-form owner/repo and basename resolve
After exact lock `name` and exact lock `repo_url` matching, `deps why` MUST attempt short-form resolution derived only from lock `repo_url` values (no invented aliases). It MUST first try a unique **`owner/repo`** form (last two URL path segments; strip a trailing `.git` from the repo segment; if fewer than two segments, treat the full `repo_url` as the identity for this form). If that form yields zero matches, it MUST then try a unique **basename** form (last path segment; strip a trailing `.git`). A unique hit on either short form MUST take the same success path as an exact match (human chains and/or `--json` `package`+`paths`, exit `0`). Exact forms MUST be preferred over short forms: when the query already matches exactly one package by `name` or `repo_url`, the command MUST NOT expand into short-form candidates that would collide with that exact hit.

#### Scenario: Unique owner/repo resolves
- **WHEN** the lock contains a package whose `repo_url` normalizes to owner/repo `acme-org/shared-utils` and no other package shares that owner/repo, and `deps why acme-org/shared-utils` runs
- **THEN** the command MUST resolve that package (exit `0` on the success path)

#### Scenario: Unique basename resolves
- **WHEN** the lock contains exactly one package whose `repo_url` basename (last segment, `.git` stripped) is `shared-utils`, and `deps why shared-utils` runs without an exact `name`/`repo_url` collision across multiple packages
- **THEN** the command MUST resolve that package (exit `0`)

#### Scenario: Trailing .git is stripped for short forms
- **WHEN** a lock `repo_url` ends with `.git` and the caller queries the basename or owner/repo without `.git`
- **THEN** the command MUST treat the stripped form as matching that package for short-form resolution

#### Scenario: Exact match wins over basename collision
- **WHEN** the query exactly equals lock `name` or `repo_url` of package A, and the same query string would also be the basename of a different package B
- **THEN** the command MUST select A via the exact form and MUST NOT fail as ambiguous solely due to B's basename

### Requirement: deps why ambiguous short-form matches
When a short-form resolve step (`owner/repo` or basename) matches two or more distinct lock packages, `deps why` MUST fail with exit `1` and MUST NOT pick arbitrarily. With `--json`, stderr MUST contain JSON with `"error": "ambiguous"`, the original `query`, and a `matches` array of identity objects `{ "name"?: string, "repo_url"?: string }` — include `repo_url` when known on the lock entry and `name` when present (same object shape as P6f; not a bare string list). Human (non-JSON) output MUST indicate ambiguity. Zero matches after all forms (exact then owner/repo then basename) MUST remain `not_installed` exit `1`; missing lock MUST remain exit `2`.

#### Scenario: Ambiguous basename fails with matches
- **WHEN** two lock packages share the same `repo_url` basename and `deps why <that-basename> --json` runs
- **THEN** exit code MUST be `1`, stderr JSON MUST have `"error": "ambiguous"`, and `matches` MUST list both candidates with enough identity (`repo_url` preferred when present)

#### Scenario: Ambiguous owner/repo fails
- **WHEN** two lock packages normalize to the same `owner/repo` and `deps why owner/repo` runs
- **THEN** exit code MUST be `1` and the failure MUST be ambiguous (not an arbitrary pick)

### Requirement: deps clean --dry-run preview
When `deps clean --dry-run` is invoked, the command MUST report what a modules wipe would remove (entry count and/or entry names under the project modules-cache root) and MUST NOT delete any files. `--dry-run` MUST NOT require `-y` / `--yes`. An absent modules directory MUST succeed with exit `0` and a truthful already-clean / would-remove-0 message. Real wipe without `--dry-run` MUST keep refuse-without-`-y` behavior. Help MUST document `--dry-run` only when this behavior is shipped and MUST NOT claim shared APM git/http cache deletion.

#### Scenario: dry-run does not delete
- **WHEN** a project has populated `apm_modules` and `deps clean --dry-run` runs
- **THEN** modules content MUST remain and the exit code MUST be `0`, with output indicating would-remove entries

#### Scenario: dry-run without yes
- **WHEN** `deps clean --dry-run` runs without `-y` / `--yes`
- **THEN** the command MUST NOT refuse solely for lack of yes and MUST NOT delete

#### Scenario: dry-run absent modules
- **WHEN** `deps clean --dry-run` runs and `apm_modules` is absent
- **THEN** the exit code MUST be `0` and the report MUST indicate nothing would be removed (already clean)

## MODIFIED Requirements

### Requirement: deps why query matches name and repo_url
Query resolution for `deps why` MUST treat an exact lock `name` match and an exact lock `repo_url` match as valid ways to select the target package. A query that matches exactly one package by either field MUST succeed. After exact forms, the command MUST also support unique `owner/repo` and unique basename short forms per the short-form resolve requirement. When multiple packages match at the active resolve form, the command MUST fail as ambiguous (exit `1`) rather than pick arbitrarily. Exact forms MUST be evaluated before short forms.

#### Scenario: Match by repo_url
- **WHEN** the lock has a package whose `repo_url` is `https://example.com/org/pkg.git` and `deps why https://example.com/org/pkg.git` runs
- **THEN** the command MUST resolve that package (exit `0` on success path) even if the caller did not pass the lock `name`

#### Scenario: Match by name
- **WHEN** the lock has a package with `name` `org/pkg` and `deps why org/pkg` runs
- **THEN** the command MUST resolve that package

#### Scenario: Short forms after exact
- **WHEN** the query does not exactly match any lock `name` or `repo_url` but uniquely matches one package via `owner/repo` or basename derived from `repo_url`
- **THEN** the command MUST resolve that package
