## ADDED Requirements

### Requirement: Pack collection honors .bapmignore

When collecting the default pack file set for M7 plain-zip archive mode (including dry-run validation of the collect set), the system MUST apply project-root `.bapmignore` rules defined by `pack-bapmignore`. Matched paths MUST be silently omitted from the zip. Existing hard excludes, personal-omit basenames, symlink refuse, and secret-pattern refuse for non-ignored paths MUST remain unchanged. Pack MUST still require a dual-read root manifest in the collected set after ignore application.

#### Scenario: Pack zip omits ignored skill docs

- **WHEN** pack `--archive` runs on a conforming project whose `.bapmignore` matches `CHANGELOG.md` and `docs/**`
- **THEN** the resulting zip MUST NOT contain `CHANGELOG.md` or any `docs/` members, and MUST still contain the root dual-read manifest

#### Scenario: Pack dry-run applies the same omit set

- **WHEN** pack runs with `--dry-run` on a project with `.bapmignore` patterns that would omit `README.md`
- **THEN** the dry-run collect/validate path MUST treat `README.md` as omitted (and MUST NOT leave a durable archive as published output per existing dry-run rules)
