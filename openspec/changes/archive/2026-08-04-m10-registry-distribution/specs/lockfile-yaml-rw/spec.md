## MODIFIED Requirements

### Requirement: Hash envelope normalize

On read, a bare 64-hex hash MUST be treated as `sha256:<hex>`. On write, hash fields the system emits MUST use `<algo>:<hex>` envelope form (req-lk-016). Accepting envelope form on read MUST succeed. Archive/download verification of `resolved_hash` for registry fetches is performed by the registry resolve/install path (lk-013 / rs-009); lockfile load/serialize alone MUST still NOT network-fetch or extract archives.

#### Scenario: Bare hex normalized on read

- **WHEN** a hash field contains a bare 64-character hex string
- **THEN** the in-memory model MUST treat it as `sha256:<hex>`

#### Scenario: Envelope form emitted on write

- **WHEN** a lockfile with normalized hashes is serialized
- **THEN** emitted hash fields MUST use `<algo>:<hex>` form

#### Scenario: Shape validation still no network

- **WHEN** a lockfile with `source: registry` and `resolved_hash` is loaded for shape validation only
- **THEN** load/serialize MUST NOT perform network fetch or archive extract
