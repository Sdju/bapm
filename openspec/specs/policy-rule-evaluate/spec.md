# policy-rule-evaluate Specification

## Purpose

Evaluates parsed policy rules against an install candidate dependency set so allow/deny/require, depth, and pinned-constraint violations can drive off/warn/block enforcement outcomes.

## Requirements

### Requirement: Deny wins over allow

When evaluating a dependency identity against policy, an explicit deny match MUST produce a violation even if the same identity also matches allow (deny wins).

#### Scenario: Allow org star deny legacy

- **WHEN** policy allows `org/*`, denies `org/legacy`, and the candidate set includes `org/legacy`
- **THEN** evaluation MUST report a deny violation for `org/legacy`

### Requirement: Require missing is a violation

When `dependencies.require` lists an identity that is absent from the install candidate set, evaluation MUST report a violation.

#### Scenario: Required package missing

- **WHEN** policy requires `org/base` and the candidate set does not include it
- **THEN** evaluation MUST report a require violation

### Requirement: Require pinned constraint flags unbounded directs

When `require_pinned_constraint` is true, evaluation MUST flag **direct** dependencies that are unbounded (no ref, `*`, bare branch, or `>=X` without upper bound) as violations, and MUST accept pinned forms: 40-hex SHA, `v?semver` tag, bounded range, `source: registry`, and local path (pl-007/008).

#### Scenario: Star constraint violates when pinned required

- **WHEN** `require_pinned_constraint` is true and a direct dependency uses `*`
- **THEN** evaluation MUST report a pinned-constraint violation

#### Scenario: Forty-hex pin accepted

- **WHEN** `require_pinned_constraint` is true and a direct dependency is pinned to a 40-hex SHA
- **THEN** evaluation MUST NOT report a pinned-constraint violation for that dep

### Requirement: Max depth against graph

When `dependencies.max_depth` is set, a resolved graph deeper than that maximum MUST produce a violation.

#### Scenario: Graph exceeds max depth

- **WHEN** policy sets `max_depth` to N and the candidate graph depth is greater than N
- **THEN** evaluation MUST report a max-depth violation

### Requirement: Enforcement modes map to gate outcomes

Evaluation combined with `enforcement` MUST yield: `off` → checks skipped or non-blocking; `warn` → violations collected as warnings, not blocking; `block` → violations are blocking. Absent policy MUST mean ungated (no violations from policy).

#### Scenario: Block marks blocking result

- **WHEN** enforcement is `block` and at least one violation exists
- **THEN** the evaluation result MUST be marked blocking

#### Scenario: Warn collects non-blocking warnings

- **WHEN** enforcement is `warn` and at least one violation exists
- **THEN** warnings MUST be collected and the result MUST NOT be marked blocking

#### Scenario: Off skips enforcement

- **WHEN** enforcement is `off`
- **THEN** policy checks MUST NOT block the install

### Requirement: Dependency policy identity casing (req-pl-018)

When matching `dependencies.allow`, `dependencies.deny`, and exact `dependencies.require` against a dependency subject, the system MUST apply OpenAPM **req-pl-018**:

- The match subject is the canonical host-blind package path (repository coordinate plus any virtual in-repository path, `#` reference suffix excluded).
- Repository-coordinate segments MUST be compared under the same per-host / registry case rule disclosed for Consumer identity (req-rs-016 clause 3): case-insensitive ASCII (`A–Z` → `a–z` only) for `github.com`, hosts ending in `.ghe.com`, the literal `GITHUB_HOST` GHES host, and registry-sourced dependencies (including registry prefixes); case-sensitive for local, marketplace, and every other host.
- Only the first N repository-coordinate segments (before any virtual path) are eligible for case-insensitive comparison on both subject and pattern; for globs, the eligible prefix MUST stop before the first pattern segment containing `**`. Virtual paths, `#` refs, registry names, MCP names, and unmanaged-file paths MUST remain byte-exact.
- Normalization applies at **match time only**. Policy-chain merge (intersection / union / dedupe) MUST continue to compare authored entries byte-exactly.
- `deny` MUST retain precedence over `allow` after normalization. Where byte-exact matching is required, a case-only difference MUST NOT match.
- Exact `require` treats `*` as literal; the package portion is text before the first `#`.

#### Scenario: Lowercase deny matches mixed-case GitHub identity

- **WHEN** enforcement is `block`, policy denies `devexpgbb/**`, and the candidate set includes `DevExpGbb/Secure-Baseline`
- **THEN** evaluation MUST report a deny violation (fail-closed; no deny fail-open)

#### Scenario: Mixed-case allow matches lowercased GitHub identity

- **WHEN** enforcement is `block`, policy allows only `DevExpGbb/**`, and the candidate set includes `devexpgbb/secure-baseline`
- **THEN** evaluation MUST NOT report an allow-list violation for that identity

#### Scenario: Exact require is case-insensitive on GitHub coordinates

- **WHEN** policy requires `DevExpGbb/Secure-Baseline` and the candidate set includes `devexpgbb/secure-baseline`
- **THEN** evaluation MUST treat the require as satisfied

#### Scenario: Virtual path remains case-sensitive

- **WHEN** policy allows `devexpgbb/secure-baseline/packages/**` and the candidate identity is `DevExpGbb/Secure-Baseline/Packages/My-Skill`
- **THEN** evaluation MUST NOT treat the allow pattern as matching (virtual-path case differs)

#### Scenario: Case-sensitive host stays byte-exact

- **WHEN** the candidate is a non-case-insensitive host identity such as `gitlab.com/DevExpGbb/Secure-Baseline` and policy allows only `devexpgbb/**`
- **THEN** evaluation MUST NOT match that allow pattern against the repository path

#### Scenario: Registry source folds repository coordinates

- **WHEN** a registry-sourced dependency has repository coordinate `DevExpGbb/Team/Secure-Baseline` and policy allows `devexpgbb/team/secure-baseline`
- **THEN** evaluation MUST match the allow pattern regardless of host documentation for that registry transport

#### Scenario: Deny still wins after normalization

- **WHEN** policy allows `DevExpGbb/**`, denies `devexpgbb/legacy`, and the candidate set includes `DevExpGbb/Legacy`
- **THEN** evaluation MUST report a deny violation for that identity

#### Scenario: Merge keeps authored case variants distinct

- **WHEN** parent and child policy `allow` lists contain case-variant patterns that intersect under ASCII fold
- **THEN** merge MUST still compare those authored entries byte-exactly (folding MUST NOT run during Section 6.4 merge)
