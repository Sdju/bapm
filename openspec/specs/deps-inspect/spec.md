# deps-inspect Specification

## Purpose

Defines lock-backed `bapm deps list` and `bapm deps tree` inspection, plus optional offline `deps why` (OpenAPM rs-005) when implemented cheaply for Consumer claim posture.

## Requirements

### Requirement: deps list shows installed packages from lock
`deps list` MUST list packages from the lockfile (names, versions/pins, and source identifiers as available) and MUST exit `0` on a valid installed lock graph. When orphans under modules are detectable, the command MAY warn and tip toward prune.

#### Scenario: List lock packages
- **WHEN** `deps list` runs against a project with an installed lock graph
- **THEN** stdout MUST list locked packages with identity/version/source information and the exit code MUST be `0`

### Requirement: deps tree prints hierarchical lock graph
`deps tree` MUST print a hierarchical tree derived from the lockfile including direct dependencies and their children (including diamond/transitive shapes).

#### Scenario: Tree includes directs and children
- **WHEN** `deps tree` runs against a lock with transitive edges
- **THEN** stdout MUST show a hierarchical structure that includes directs and their children

### Requirement: deps why offline chains (SHOULD)
If `deps why` is exposed, it MUST walk reverse dependency chains offline from the lock for the named package (OpenAPM rs-005), MUST NOT require network, and MUST present root→package chains in a deterministic (lexicographic) order. Human default output MUST remain readable chain text on success. Exit and JSON behavior MUST follow the added why requirements in this change (honest exits; optional `--json`).

#### Scenario: Why reports offline chains when implemented
- **WHEN** `deps why T` runs for a transitive T present in the lock and why is implemented
- **THEN** output MUST show one or more root→T chains computed only from lock data without network access

### Requirement: deps why JSON success document
When `deps why <query> --json` succeeds, the command MUST print a single JSON object on **stdout** with stable top-level keys `package` and `paths`. The `package` object MUST include identity fields available on the lock entry (`name` and/or `repo_url` — both when present), a `version` string (tag/ref/commit fallback), `source`, and boolean `is_direct`. The `paths` value MUST be an array of objects each with a `chain` array of nodes `{ identity fields, constraint | null, is_direct }`, ordered deterministically. Why MUST remain offline (lockfile sole graph source; no network).

#### Scenario: Successful why --json shape
- **WHEN** `deps why T --json` runs for a package T present in the lock
- **THEN** stdout MUST be parseable JSON containing `package` and `paths`, exit code MUST be `0`, and the command MUST NOT require network access

#### Scenario: Transitive chain includes parent
- **WHEN** `deps why T --json` runs for transitive T whose lock `resolved_by` (or equivalent) names a direct parent P
- **THEN** at least one `paths[].chain` MUST include P before T (or annotate directness via `is_direct` consistently with the lock graph)

### Requirement: deps why honest exit codes
`deps why` MUST exit `0` only when the query resolves to exactly one installed lock package and chains are produced. It MUST exit `1` when the query is not installed or is ambiguous. It MUST exit `2` when the lockfile is missing or unreadable. Pretending success with exit `0` for absent packages or missing lock is FORBIDDEN (including the non-`--json` human path).

#### Scenario: Missing package is non-zero
- **WHEN** `deps why missing-pkg` runs against a valid lock that does not contain that package
- **THEN** the exit code MUST be `1` (not `0`)

#### Scenario: Missing lock is exit 2
- **WHEN** `deps why anything` runs in a project with no readable lockfile
- **THEN** the exit code MUST be `2`

#### Scenario: Success remains zero
- **WHEN** `deps why T` runs for an installed T
- **THEN** the exit code MUST be `0` and human-readable chain text MUST still be printed when `--json` is absent

### Requirement: deps why JSON error object
When `deps why --json` fails, the command MUST emit a JSON object on **stderr** whose `error` field is one of `no_lockfile`, `not_installed`, or `ambiguous`. For `not_installed` and `ambiguous`, the object SHOULD include the original `query`; for `ambiguous`, it MUST include a `matches` array identifying candidates. Success JSON MUST NOT be written to stderr.

#### Scenario: JSON not_installed on stderr
- **WHEN** `deps why missing --json` runs against a valid lock without that package
- **THEN** stderr MUST contain JSON with `"error": "not_installed"` and exit code MUST be `1`

#### Scenario: JSON no_lockfile on stderr
- **WHEN** `deps why x --json` runs with no readable lock
- **THEN** stderr MUST contain JSON with `"error": "no_lockfile"` and exit code MUST be `2`

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

### Requirement: deps clean modules wipe alias
`deps clean` MUST perform the same project modules wipe as `cache clean` against the project `apm_modules` (or documented modules-cache root): with `-y` / `--yes` it MUST remove modules-cache content equivalently; without `-y`/`--yes` it MUST refuse with non-zero exit and MUST NOT silent-delete. An absent modules directory MUST be treated as already clean success (exit `0`) when `-y` is provided. `deps clean` MUST NOT delete APM shared git/http cache (that surface remains out of scope). Help MUST state that `deps clean` is equivalent to the modules wipe performed by `cache clean`, not a shared git cache clean.

#### Scenario: deps clean -y matches cache clean -y
- **WHEN** a project has populated `apm_modules` and `deps clean -y` runs
- **THEN** modules content under that root MUST be removed equivalently to `cache clean -y` on the same tree

#### Scenario: deps clean without yes refuses
- **WHEN** `deps clean` runs without `-y` / `--yes`
- **THEN** the exit code MUST be non-zero and modules content MUST remain

#### Scenario: Absent modules already clean
- **WHEN** `deps clean -y` runs and `apm_modules` is absent
- **THEN** the exit code MUST be `0`

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
