## ADDED Requirements

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
