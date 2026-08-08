## ADDED Requirements

### Requirement: Dual-write deployed_files lists with hashes

When install records `deployed_file_hashes` for a dependency (or `local_deployed_file_hashes` at document level) during lock write-back after materialize, install MUST also keep the parallel `deployed_files` / `local_deployed_files` string lists in sync with the hash-map keys for those same paths (union so list membership includes hash keys written in that pass). Find MUST remain correct when only hash maps exist on older locks; dual-write is for APM-shaped inventory parity and list consumers. Dual-write MUST NOT change the hash algorithm or orphan-cleanup keying off hash maps.

#### Scenario: Hash write also updates list field

- **WHEN** a non-frozen install writes `deployed_file_hashes` for dependency paths after materialize
- **THEN** the same lock dependency entry MUST include `deployed_files` listing those path keys

#### Scenario: Local hashes dual-write local list

- **WHEN** install writes document-level `local_deployed_file_hashes`
- **THEN** the lock document MUST include `local_deployed_files` listing those path keys
