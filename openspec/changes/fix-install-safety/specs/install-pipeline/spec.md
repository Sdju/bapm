## MODIFIED Requirements

### Requirement: Install accepts a local pack archive path

Install MUST accept a local filesystem path to a pack-produced plain zip as an install source. When the argument is such an archive, install MUST extract/consume the conforming layout (manifest at expected root; optional packed lock/primitives) into the target project directory and MUST make the resulting manifest dual-read parseable. On invalid archive layout or failing manifest validate, install MUST fail closed with non-zero exit. This path is the primary round-trip for pack (unpack-equivalent). Full network resolve of archive-embedded deps MAY proceed via existing install orchestration after extract when dependencies are present.

Archive extract into the project MUST be additive: files and directories in the project that are not members of the archive MUST remain untouched (including `.git/`). When an archive member would overwrite an existing project file whose bytes differ, install MUST fail closed before writing any archive member and the diagnostic MUST name at least one conflicting path. Existing files with identical bytes MUST NOT count as conflicts. Extract MUST NOT create, modify, or delete anything outside the project directory.

#### Scenario: Install from pack zip lands manifest

- **WHEN** install is invoked with a path to a valid pack-produced zip containing `bapm.yml` (or `apm.yml`) at the expected root
- **THEN** the project output MUST contain a dual-read parseable manifest and the command MUST NOT treat the zip as an unknown package ref without attempting archive consume

#### Scenario: Corrupt archive fails closed

- **WHEN** install is invoked with a path that is not a valid pack zip layout
- **THEN** install MUST exit non-zero without claiming a successful archive install

#### Scenario: Unrelated project files survive archive install

- **WHEN** install is invoked with a valid pack zip in a directory that already contains `.git/` and files not present in the archive
- **THEN** after install those files and `.git/` MUST still exist with unchanged content

#### Scenario: Conflicting file fails closed before writes

- **WHEN** the project already has `bapm.yml` whose bytes differ from the archive's `bapm.yml`
- **THEN** install MUST exit non-zero, MUST name `bapm.yml` in the diagnostic, and MUST NOT write any archive member into the project

#### Scenario: Nothing is written next to the project

- **WHEN** install from archive runs in `<parent>/project`
- **THEN** no new entries MUST appear in `<parent>` during or after the operation
