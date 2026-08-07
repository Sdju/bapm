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
