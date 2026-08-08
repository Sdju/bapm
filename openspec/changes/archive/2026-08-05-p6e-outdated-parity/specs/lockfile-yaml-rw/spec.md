## MODIFIED Requirements

### Requirement: Accept deferred runtime field shapes without executing them

The system MUST accept and emit shapes for `constraint` / `resolved_tag` / `resolved_at` / `resolved_ref` (req-lk-008 and APM pin identity), `deployed_file_hashes` / `local_deployed_file_hashes` (req-lk-012), `resolved_hash` (req-lk-013), and `tree_sha256` (req-lk-015) when present. M2 MUST NOT resolve semver, compute hashes from disk, verify archives, or recompute tree hashes. When `resolved_ref` is present on load, serialize MUST preserve it (including when the entry was produced by APM or an older bapm lock that already carried the field).

#### Scenario: Deferred fields preserved without runtime verify

- **WHEN** a lockfile includes those deferred fields with valid envelope/string shapes
- **THEN** parse and serialize MUST succeed without performing resolve, download, or hash recompute

#### Scenario: resolved_ref round-trips on load serialize

- **WHEN** a dependency entry includes `resolved_ref: release` alongside `resolved_commit`
- **THEN** load→serialize MUST emit `resolved_ref` with the same string value
