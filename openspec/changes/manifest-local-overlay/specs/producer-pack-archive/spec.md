## ADDED Requirements

### Requirement: Pack excludes bapm.local.yml

When collecting the default pack file set, the system MUST omit `bapm.local.yml` at the project root (and MUST NOT nest it under archive paths). Presence of an untracked personal overlay MUST NOT alone cause pack secret-refuse failure. Other pack validation (manifest schema, secret basename patterns) MUST remain unchanged.

#### Scenario: Archive does not contain personal overlay

- **WHEN** pack `--archive` runs on a conforming project that also has `bapm.local.yml`
- **THEN** the resulting zip MUST NOT contain a member named `bapm.local.yml`
