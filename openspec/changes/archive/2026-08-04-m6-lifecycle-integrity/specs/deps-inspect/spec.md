## Purpose

Defines lock-backed `bapm deps list` and `bapm deps tree` inspection, plus optional offline `deps why` (OpenAPM rs-005) when implemented cheaply for Consumer claim posture.

## ADDED Requirements

### Requirement: deps list shows installed packages from lock

`deps list` MUST list packages from the lockfile (names, versions/pins, and source identifiers as available) and MUST exit `0` on a valid installed lock graph. When orphans under modules are detectable, the command MAY warn and tip toward prune.

#### Scenario: List lock packages

- **WHEN** `deps list` runs against a project with an installed lock graph
- **THEN** stdout MUST list locked packages with identity/version/source information and the exit code MUST be `0`

### Requirement: deps tree prints hierarchical lock graph

`deps tree` MUST print a hierarchical tree derived from the lockfile including direct dependencies and their children (including diamond/transitive shapes).

#### Scenario: Tree includes directs and children

- **WHEN** `deps tree` runs against a lock with transitive edges
- **THEN** stdout MUST show a hierarchical structure that includes directs and their children

### Requirement: deps why offline chains (SHOULD)

If `deps why` is exposed, it MUST walk reverse dependency chains offline from the lock for the named package (OpenAPM rs-005), MUST NOT require network, and MUST present root→package chains in a deterministic (lexicographic) order. If not exposed in M6, documentation MUST note deferral.

#### Scenario: Why reports offline chains when implemented

- **WHEN** `deps why T` runs for a transitive T present in the lock and why is implemented
- **THEN** output MUST show one or more root→T chains computed only from lock data without network access
