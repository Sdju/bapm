## Purpose

Discovers which project manifest file to load for bapm: explicit path, or exactly one of `apm.yml` / `bapm.yml` at the project root, with hard errors on conflict or absence.

## ADDED Requirements

### Requirement: Explicit manifest path wins
When a caller supplies an explicit filesystem path to a manifest file, the system MUST load that path and MUST NOT search for sibling `apm.yml` or `bapm.yml` names.

#### Scenario: Explicit path to apm.yml
- **WHEN** the caller requests load with an explicit path pointing at an existing `apm.yml`
- **THEN** the system MUST load that file successfully regardless of whether `bapm.yml` also exists in the same directory

#### Scenario: Explicit path to bapm.yml
- **WHEN** the caller requests load with an explicit path pointing at an existing `bapm.yml`
- **THEN** the system MUST load that file successfully regardless of whether `apm.yml` also exists in the same directory

#### Scenario: Explicit path missing
- **WHEN** the caller requests load with an explicit path that does not exist
- **THEN** the system MUST fail with a missing-file error that identifies the requested path

### Requirement: Project root is process cwd without walk-up
When no explicit path is supplied, the system MUST treat the project root as the process current working directory (or an explicitly provided root directory argument defaulting to cwd) and MUST NOT walk parent directories looking for a manifest.

#### Scenario: Manifest only in parent directory
- **WHEN** discovery runs with cwd lacking both `apm.yml` and `bapm.yml`, but a parent directory contains one of them
- **THEN** the system MUST fail with a no-manifest error and MUST NOT load the parent file

### Requirement: Single-file discovery matrix
When no explicit path is supplied, the system MUST resolve the manifest filename by existence of `apm.yml` and `bapm.yml` in the project root as follows: only `apm.yml` → load it; only `bapm.yml` → load it; both present → hard error; neither present → hard error. The system MUST NOT merge contents of both files.

#### Scenario: Only apm.yml present
- **WHEN** the project root contains `apm.yml` and does not contain `bapm.yml`
- **THEN** the system MUST load `apm.yml` (drop-in for existing APM projects)

#### Scenario: Only bapm.yml present
- **WHEN** the project root contains `bapm.yml` and does not contain `apm.yml`
- **THEN** the system MUST load `bapm.yml`

#### Scenario: Both files present
- **WHEN** the project root contains both `apm.yml` and `bapm.yml` and no explicit path is given
- **THEN** the system MUST fail with a hard error that names both paths and MUST NOT load either file

#### Scenario: Neither file present
- **WHEN** the project root contains neither `apm.yml` nor `bapm.yml` and no explicit path is given
- **THEN** the system MUST fail with a no-manifest error

### Requirement: Filename is discovery only; schema is shared
`apm.yml` and `bapm.yml` MUST use the same manifest field schema. Discovery MAY record which filename was loaded for later write-back, but MUST NOT apply different validation rules based on filename.

#### Scenario: Same bytes under either name
- **WHEN** identical valid manifest bytes are discovered as `apm.yml` only, then separately as `bapm.yml` only
- **THEN** both loads MUST succeed with equivalent validated documents

### Requirement: Write-back target is the loaded filename
When a future rewrite/write-back API exists, the system MUST write to the same filename that was loaded and MUST NOT auto-create the sibling brand name. M1 MUST document this contract; M1 itself MUST NOT implement rewrite.

#### Scenario: Documented same-filename write-back
- **WHEN** a consumer inspects M1 discovery/load result metadata
- **THEN** the result MUST expose which filename was loaded so a later rewrite can target that same path
