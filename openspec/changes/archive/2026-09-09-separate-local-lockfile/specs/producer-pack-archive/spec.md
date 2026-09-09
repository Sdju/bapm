## ADDED Requirements

### Requirement: Pack excludes bapm.local.lock.yaml

When collecting the default pack file set, the system MUST omit `bapm.local.lock.yaml` at the project root (and MUST NOT nest it under archive paths). Presence of an untracked personal lock MUST NOT alone cause pack secret-refuse failure. Other pack validation (manifest schema, secret basename patterns) MUST remain unchanged. Pack MAY still embed the shared lock when present per existing pack-lock rules.

#### Scenario: Archive does not contain personal lock

- **WHEN** pack `--archive` runs on a conforming project that also has `bapm.local.lock.yaml`
- **THEN** the resulting zip MUST NOT contain a member named `bapm.local.lock.yaml`
