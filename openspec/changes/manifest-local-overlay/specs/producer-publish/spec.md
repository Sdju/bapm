## ADDED Requirements

### Requirement: Publish archives exclude bapm.local.yml

When publish builds a flat registry zip (or equivalent upload archive) from the project tree, the archive MUST NOT include `bapm.local.yml`. Publish MUST continue to use the dual-read base manifest for identity (`name`/`version`) and MUST NOT treat the personal overlay as the wire manifest root.

#### Scenario: Flat publish zip omits personal overlay

- **WHEN** publish builds an archive from a valid project that contains `bapm.local.yml` beside the base manifest
- **THEN** the zip MUST contain the wire `apm.yml` (or required layout) and MUST NOT include `bapm.local.yml`
