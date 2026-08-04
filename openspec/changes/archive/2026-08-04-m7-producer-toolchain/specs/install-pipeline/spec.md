## ADDED Requirements

### Requirement: Install accepts a local pack archive path
Install MUST accept a local filesystem path to a pack-produced plain zip as an install source. When the argument is such an archive, install MUST extract/consume the conforming layout (manifest at expected root; optional packed lock/primitives) into the target project directory and MUST make the resulting manifest dual-read parseable. On invalid archive layout or failing manifest validate, install MUST fail closed with non-zero exit. This path is the primary M7 round-trip for pack (unpack-equivalent). Full network resolve of archive-embedded deps MAY proceed via existing install orchestration after extract when dependencies are present.

#### Scenario: Install from pack zip lands manifest
- **WHEN** install is invoked with a path to a valid pack-produced zip containing `bapm.yml` (or `apm.yml`) at the expected root
- **THEN** the project output MUST contain a dual-read parseable manifest and the command MUST NOT treat the zip as an unknown package ref without attempting archive consume

#### Scenario: Corrupt archive fails closed
- **WHEN** install is invoked with a path that is not a valid pack zip layout
- **THEN** install MUST exit non-zero without claiming a successful archive install
