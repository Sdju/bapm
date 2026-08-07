# lockfile-dual-file-discovery Specification

## Purpose

Discovers which project lockfile to load or create for bapm: explicit path, or exactly one of `apm.lock.yaml` / `bapm.lock.yaml` at the project root, with hard dual-conflict errors, same-name write-back, and greenfield default `bapm.lock.yaml`.

## Requirements

### Requirement: Explicit lockfile path wins

When a caller supplies an explicit filesystem path to a lockfile, the system MUST use that path and MUST NOT search for sibling `apm.lock.yaml` or `bapm.lock.yaml` names.

#### Scenario: Explicit path to apm.lock.yaml

- **WHEN** the caller requests discover or load with an explicit path pointing at an existing `apm.lock.yaml`
- **THEN** the system MUST resolve that file successfully regardless of whether `bapm.lock.yaml` also exists in the same directory

#### Scenario: Explicit path to bapm.lock.yaml

- **WHEN** the caller requests discover or load with an explicit path pointing at an existing `bapm.lock.yaml`
- **THEN** the system MUST resolve that file successfully regardless of whether `apm.lock.yaml` also exists in the same directory

#### Scenario: Explicit path missing on load

- **WHEN** the caller requests load with an explicit path that does not exist
- **THEN** the system MUST fail with a missing-file error that identifies the requested path

### Requirement: Project root is cwd without walk-up

When no explicit path is supplied, the system MUST treat the project root as the process current working directory (or an explicitly provided root directory argument defaulting to cwd) and MUST NOT walk parent directories looking for a lockfile.

#### Scenario: Lockfile only in parent directory

- **WHEN** discovery runs with cwd lacking both lock filenames, but a parent directory contains one of them
- **THEN** the system MUST fail with a no-lockfile outcome and MUST NOT load the parent file

### Requirement: Dual-file existence matrix for load discovery

When no explicit path is supplied, the system MUST resolve the lockfile by existence of `apm.lock.yaml` and `bapm.lock.yaml` in the project root as follows: only `apm.lock.yaml` → that file; only `bapm.lock.yaml` → that file; both present → hard error naming both paths; neither → distinct no-lockfile outcome. The system MUST NOT merge contents of both files.

#### Scenario: Only apm.lock.yaml present

- **WHEN** the project root contains `apm.lock.yaml` and does not contain `bapm.lock.yaml`
- **THEN** discovery MUST resolve `apm.lock.yaml` (drop-in for existing APM projects)

#### Scenario: Only bapm.lock.yaml present

- **WHEN** the project root contains `bapm.lock.yaml` and does not contain `apm.lock.yaml`
- **THEN** discovery MUST resolve `bapm.lock.yaml`

#### Scenario: Both lockfiles present

- **WHEN** the project root contains both `apm.lock.yaml` and `bapm.lock.yaml` and no explicit path is given
- **THEN** the system MUST fail with a hard dual-conflict error that names both paths and MUST NOT load either file

#### Scenario: Neither lockfile — strict load

- **WHEN** the project root contains neither lockfile and the caller uses discover or strict load
- **THEN** the system MUST fail with a typed no-lockfile / not-found error

#### Scenario: Neither lockfile — nullable load

- **WHEN** the project root contains neither lockfile and the caller uses a nullable load API
- **THEN** the system MUST return null without throwing a dual-conflict error

### Requirement: Filename is discovery only; schema is shared

`apm.lock.yaml` and `bapm.lock.yaml` MUST use the same lockfile field schema. Discovery MAY record which filename was loaded for write-back, but MUST NOT apply different validation rules based on filename. Dual-read of lockfiles MUST NOT be coupled to which manifest brand file is present.

#### Scenario: Same bytes under either lock name

- **WHEN** identical valid lockfile bytes are discovered as `apm.lock.yaml` only, then separately as `bapm.lock.yaml` only
- **THEN** both loads MUST succeed with equivalent validated documents

#### Scenario: Manifest brand independent of lock brand

- **WHEN** a project has `apm.yml` together with only `bapm.lock.yaml` (or any other brand combination)
- **THEN** lockfile discovery MUST succeed or fail solely by lockfile rules and MUST NOT require matching manifest filename brand

### Requirement: Write-back uses the loaded filename

When writing an already-loaded lockfile, the system MUST write to the same filename (or explicit path) that was loaded and MUST NOT auto-create or rename to the sibling brand name.

#### Scenario: Write-back apm.lock.yaml leaves sibling absent

- **WHEN** a lockfile was loaded from `apm.lock.yaml`, mutated, and saved without an overriding explicit path
- **THEN** the system MUST write `apm.lock.yaml` and MUST NOT create `bapm.lock.yaml`

#### Scenario: Write-back bapm.lock.yaml leaves sibling absent

- **WHEN** a lockfile was loaded from `bapm.lock.yaml`, mutated, and saved without an overriding explicit path
- **THEN** the system MUST write `bapm.lock.yaml` and MUST NOT create `apm.lock.yaml`

### Requirement: Fresh create defaults to bapm.lock.yaml

When neither lockfile exists and the caller intends to create a new lockfile without an explicit path, the system MUST write `bapm.lock.yaml`.

#### Scenario: Fresh write without path

- **WHEN** neither `apm.lock.yaml` nor `bapm.lock.yaml` exists at the project root and write is invoked without an explicit path
- **THEN** the system MUST create `bapm.lock.yaml`

#### Scenario: Fresh write with explicit path

- **WHEN** neither brand file exists and write is invoked with an explicit path
- **THEN** the system MUST write that explicit path and MUST NOT force `bapm.lock.yaml`

### Requirement: Legacy apm.lock is out of M2 dual-read

The system MUST NOT dual-read or auto-migrate legacy `apm.lock` (non-`.yaml`) as part of M2 discovery.

#### Scenario: Only legacy apm.lock present

- **WHEN** the project root contains only legacy `apm.lock` and neither `apm.lock.yaml` nor `bapm.lock.yaml`
- **THEN** discovery / strict load MUST treat this as no lockfile (not-found), not as a successful load
