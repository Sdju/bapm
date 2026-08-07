# view-local-inspect Specification

## Purpose

Defines offline core inspection of a single installed lock package: resolve the query, locate its modules tree, and expose identity, pin/ref, path, and optional package-manifest summary without network I/O.

## Requirements

### Requirement: View resolves one installed lock package offline

Core local view MUST load the project lockfile and resolve the package query using the same offline forms as `deps why`: exact lock `name`, then exact lock `repo_url`, then unique `owner/repo`, then unique basename derived from `repo_url` (strip trailing `.git`). Exact forms MUST win over short forms. When exactly one package matches, view MUST succeed. When zero packages match, view MUST fail as not installed. When two or more packages match at the active resolve form, view MUST fail as ambiguous. View MUST NOT perform network, registry, marketplace, or remote version I/O.

#### Scenario: Exact name resolves

- **WHEN** local view runs for a query that exactly equals one lock package `name`
- **THEN** the result MUST succeed for that package and MUST NOT require network access

#### Scenario: Unique basename resolves

- **WHEN** the query does not exact-match `name` or `repo_url` but uniquely matches one lock package via `repo_url` basename
- **THEN** the result MUST succeed for that package

#### Scenario: Ambiguous query fails

- **WHEN** a short-form query matches two or more distinct lock packages
- **THEN** the result MUST fail as ambiguous (not an arbitrary pick)

#### Scenario: Missing package fails

- **WHEN** the query matches no installed lock package after all resolve forms
- **THEN** the result MUST fail as not installed

### Requirement: View reports identity, pin, modules path, and optional summary

On success, local view MUST expose: package identity available on the lock entry (`name` and/or `repo_url`), a version/pin string derived from lock fields (`version`, else `resolved_ref`, else `resolved_tag`, else short `resolved_commit` when present), the on-disk path under the project modules root (`apm_modules`) when locatable, and a summary string when the package manifest under that path provides `summary` or `description`. When the modules tree cannot be located, view MAY still succeed with lock identity and pin and MUST indicate that the modules path is unavailable rather than inventing a path. When neither `summary` nor `description` is present on the package manifest (or the manifest is absent), summary MUST be omitted or empty — inventing marketing text is FORBIDDEN.

#### Scenario: Successful view includes identity and pin

- **WHEN** local view succeeds for an installed lock package with a known pin field
- **THEN** the result MUST include identity fields from the lock and a non-empty version/pin string

#### Scenario: Modules path when tree exists

- **WHEN** local view succeeds and the package tree exists under project `apm_modules`
- **THEN** the result MUST include that modules path

#### Scenario: Summary from package manifest description

- **WHEN** the located package tree contains a readable package manifest with a non-empty `description` (or `summary`) field
- **THEN** the result MUST include that text as the summary

#### Scenario: Missing summary is honest

- **WHEN** local view succeeds but the package manifest has no `summary`/`description`
- **THEN** the result MUST NOT invent a summary string

### Requirement: View honest exit codes

Local view MUST use exit code `0` only on successful inspect of exactly one package. It MUST use exit code `1` when the package query is missing, not installed, or ambiguous. It MUST use exit code `2` when the lockfile is missing or unreadable. Pretending success with exit `0` for absent packages or missing lock is FORBIDDEN.

#### Scenario: Success is zero

- **WHEN** local view runs for a uniquely installed package against a readable lock
- **THEN** the exit code MUST be `0`

#### Scenario: Not installed is one

- **WHEN** local view runs for a query absent from a valid lock
- **THEN** the exit code MUST be `1`

#### Scenario: Missing lock is two

- **WHEN** local view runs in a project with no readable lockfile
- **THEN** the exit code MUST be `2`

### Requirement: View human text is readable

On success without machine-output flags, local view MUST produce human-readable text that includes at least the package identity, version/pin, and modules path when known (and summary when present). On failure, human-readable error text MUST indicate the failure class (not installed, ambiguous, or no lockfile).

#### Scenario: Success text includes key fields

- **WHEN** local view succeeds for an installed package with a modules path
- **THEN** human text MUST mention the identity, version/pin, and modules path

#### Scenario: Failure text for missing package

- **WHEN** local view fails as not installed
- **THEN** human error text MUST indicate the package was not found or not installed
