## ADDED Requirements

### Requirement: Registry materialize applies shared safe-extract after digest verify

After SHA-256 digest verification succeeds (lk-013), registry archive materialize into the modules cache MUST apply the shared archive-safe-extract policy: reject `..` / absolute / symlink (and hardlink / non-regular where exposed), enforce default 10 000 entry and 100 MB uncompressed caps, and fail-closed cleanup of partial destination on extract failure. Digest mismatch MUST still fail **before** extract with modules unchanged. Safe-extract MUST NOT skip or weaken digest verify.

#### Scenario: Symlink in registry zip fails after matching digest

- **WHEN** registry bytes hash to the expected digest but the zip contains a symlink member
- **THEN** materialize MUST fail closed after digest verify and MUST NOT leave a successful package tree for that dest

#### Scenario: Caps exceeded on registry zip fails

- **WHEN** a digest-matching registry zip exceeds the default entry or uncompressed size cap
- **THEN** materialize MUST fail closed and MUST NOT treat the package as successfully extracted

#### Scenario: Digest mismatch still skips extract

- **WHEN** advertised digest does not match archive bytes
- **THEN** materialize MUST fail closed before extract and MUST NOT invoke safe-extract writes for that package
