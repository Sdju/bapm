## ADDED Requirements

### Requirement: Document bapm.local.yml as personal overlay extension

Reader-facing documentation MUST describe `bapm.local.yml` as a **bapm-only** optional personal overlay (not an OpenAPM v0.1 requirement), MUST state merge precedence (CLI flags → local → base dual-read → env overrides), MUST list that it is gitignored / pack-excluded by design, and MUST explicitly distinguish it from the bapm `local` / `local:` dependency source and from OpenAPM `path:`.

#### Scenario: Conformance or manifest docs name personal overlay

- **WHEN** a reader opens the VitePress manifest guide or the conformance / OpenAPM boundary page after this change
- **THEN** the text MUST mention `bapm.local.yml` as a bapm personal overlay and MUST NOT present it as OpenAPM wire vocabulary or as the `local` dependency source
