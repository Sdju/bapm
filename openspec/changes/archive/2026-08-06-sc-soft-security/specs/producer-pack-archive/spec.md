## ADDED Requirements

### Requirement: Pack extract applies shared safe-extract policy
Pack archive extract and install-from-archive consumption MUST apply the shared archive-safe-extract policy: reject `..` / absolute / symlink (and hardlink / non-regular where exposed), enforce default 10 000 entry and 100 MB uncompressed caps, and fail-closed cleanup of partial destination on extract failure. Path-only checks without symlink reject, caps, and cleanup MUST NOT be treated as sufficient for OpenAPM sc-002 claims.

#### Scenario: Symlink in pack zip fails extract
- **WHEN** install-from-archive or pack extract is given a zip containing a symlink member
- **THEN** extract MUST fail closed and MUST NOT leave a successful half-extracted project tree

#### Scenario: Oversized pack zip fails extract
- **WHEN** a pack zip exceeds the default entry count or uncompressed size cap
- **THEN** extract MUST fail closed
