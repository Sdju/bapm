## MODIFIED Requirements

### Requirement: Empty skill-subset match is diagnosed (req-mf-022)

When a non-empty persisted `skills:` subset is applied to a dependency that exposes selectable skills and zero skills from that dependency are deployed because no selected name matches an available skill, install MUST emit a default-visible diagnostic identifying the dependency, the requested names, and the available names (or that none are available). The CLI MUST print that diagnostic as a `bapm: warning:` line on stderr. The overall install MAY still succeed when no other error exists; this MUST NOT silently complete with zero matches and no diagnostic.

#### Scenario: Stale skill pin warns

- **WHEN** a dependency declares `skills: [gone]` and the package's available skills are `[alpha, beta]`
- **THEN** install MUST emit a diagnostic naming the dependency, `gone`, and the available names, the CLI MUST print it as `bapm: warning:`, and MUST NOT treat silence as success for that mismatch

## ADDED Requirements

### Requirement: Unmatched leftover skill-subset names are diagnosed

When a non-empty persisted `skills:` subset matches at least one available skill of that dependency and also contains names that match none, install MUST emit a default-visible diagnostic identifying the dependency and the unmatched names. Matching names MUST still be deployed. The CLI MUST print the diagnostic as a `bapm: warning:` line on stderr. The overall install MAY still succeed when no other error exists. A subset whose every name matches MUST NOT emit this diagnostic.

#### Scenario: Partial skill subset warns about unknown names

- **WHEN** a dependency declares `skills: [alpha, ghost]` and the package's available skills are `[alpha, beta]`
- **THEN** install MUST deploy `alpha`, MUST NOT deploy `ghost`, MUST emit a diagnostic naming `ghost`, and the CLI MUST print it as `bapm: warning:`

#### Scenario: Exact skill subset stays silent

- **WHEN** a dependency declares `skills: [alpha]` and the package exposes skill `alpha`
- **THEN** install MUST deploy `alpha` and MUST NOT emit an empty-subset or unmatched-subset diagnostic for that dependency
