## ADDED Requirements

### Requirement: Publish archives exclude bapm.local.lock.yaml

When publish builds a flat registry zip (or equivalent upload archive) from the project tree, the archive MUST NOT include `bapm.local.lock.yaml`. Publish MUST continue to use the dual-read base manifest for identity and MUST NOT treat the personal lock as part of the published package surface.

#### Scenario: Publish zip omits personal lock

- **WHEN** publish builds an archive from a valid project that contains `bapm.local.lock.yaml` beside the base manifest
- **THEN** the zip MUST NOT include `bapm.local.lock.yaml`
