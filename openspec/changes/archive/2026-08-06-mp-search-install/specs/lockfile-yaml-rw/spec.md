## ADDED Requirements

### Requirement: Marketplace provenance fields round-trip
Lockfile load and serialize MUST preserve dependency entry fields `discovered_via`, `marketplace_plugin_name`, `source_url`, and `source_digest` when present. These fields MUST NOT be stripped as unknown solely because they are marketplace provenance. Serialize MUST still omit them when unset/empty (no null placeholders). First-class typed fields on the lock dependency model are preferred but not required if the open index signature already preserves keys on round-trip.

#### Scenario: Provenance keys survive load then serialize
- **WHEN** a lock dependency entry includes `discovered_via`, `marketplace_plugin_name`, and optionally `source_url` / `source_digest`
- **THEN** load→serialize MUST emit the same provenance keys and values

#### Scenario: Absent provenance omitted
- **WHEN** a dependency entry has no marketplace provenance fields set
- **THEN** serialize MUST NOT emit null placeholders for those keys
