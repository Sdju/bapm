## ADDED Requirements

### Requirement: Modules download is idempotent for materialized git trees

When the modules-cache destination for a git package already holds a checkout of that repository at the requested commit, downloading that package MUST succeed without re-cloning and MUST leave the tree usable. When the destination exists but is not a checkout at the requested commit (partial clone, other commit, or plain files), the download MUST replace it with a checkout at the requested commit. Resolve followed by download within one install, and repeated installs of an unchanged manifest, MUST therefore not fail because the destination is non-empty.

#### Scenario: First install of a git dependency succeeds

- **WHEN** install runs for a manifest with one git dependency and no `apm_modules/`
- **THEN** install MUST complete successfully and the package tree MUST exist under `apm_modules/`

#### Scenario: Repeat install reuses the tree

- **WHEN** install runs again on the same project without manifest changes
- **THEN** install MUST complete successfully without failing on the existing destination

#### Scenario: Stale destination is replaced

- **WHEN** the destination directory exists but contains files that are not a git checkout of the requested commit
- **THEN** download MUST replace it and the result MUST be a checkout at the requested commit
