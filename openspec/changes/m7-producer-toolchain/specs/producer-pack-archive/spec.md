## Purpose

Builds and round-trips a plain-zip producer archive containing a conforming manifest, refusing secret-pattern paths and failing closed on schema validation errors.

## ADDED Requirements

### Requirement: Pack produces a plain zip archive with conforming manifest
Invoking pack with archive mode MUST write a durable plain zip artifact (not APM `--format plugin` host bundles). The archive root layout MUST include a dual-read conforming manifest (`bapm.yml` or `apm.yml` as discovered/written for the project). Pack MUST validate the project manifest before writing and MUST exit non-zero on schema/validate failure without publishing a successful artifact.

#### Scenario: Pack archive contains manifest at root
- **WHEN** pack runs with `--archive` against a project with a conforming `bapm.yml`
- **THEN** a zip artifact MUST exist and MUST contain the project manifest at the expected archive root layout

#### Scenario: Pack fails on invalid manifest
- **WHEN** pack runs against a project whose manifest fails OpenAPM Producer validation
- **THEN** the exit code MUST be non-zero and no successful distributable archive MUST be left as the published output

### Requirement: Pack refuses secret-pattern paths
When pack would include paths matching default secret patterns (at least `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`), pack MUST fail closed (OpenAPM sc-007 producer clause) and MUST NOT publish the archive as successful output. Pattern extension via Governance policy is out of M7 scope.

#### Scenario: Pack refuses .env
- **WHEN** the pack set includes a `.env` file (or another listed secret pattern)
- **THEN** pack MUST fail with non-zero exit and MUST NOT treat the run as a successful publish

### Requirement: Pack supports dry-run without durable artifact
When pack is invoked with `--dry-run`, the system MUST NOT leave a durable archive (or directory pack output) as the published result; temporary work MUST be cleaned up.

#### Scenario: Dry-run leaves no durable archive
- **WHEN** pack runs with `--archive` and `--dry-run` on a valid project
- **THEN** no durable pack artifact MUST remain as the command's published output

### Requirement: Round-trip via install-from-archive
The system MUST support consuming a pack-produced plain zip by invoking install with that archive path (primary M7 unpack equivalent). After install-from-archive, the extracted/consumed project MUST expose a dual-read parseable manifest (and any packed primitives at known layout). A thin `unpack` extract-only command MAY exist but is not required when install-from-archive satisfies round-trip.

#### Scenario: Install consumes packed zip
- **WHEN** `install` is invoked with a path to a pack-produced zip from a conforming project
- **THEN** the exit path MUST land a parseable manifest under the output/project root and consumer parse MUST succeed

### Requirement: Pack MAY embed lock when present
When a lockfile is present for the project, pack SHOULD include it (or an enriched copy) in the archive for Producer-as-Consumer reuse. Absence of a lock MUST NOT block packing a valid manifest-only project.

#### Scenario: Manifest-only pack succeeds
- **WHEN** pack runs on a conforming project with no lockfile
- **THEN** pack MUST succeed and the archive MUST still contain the conforming manifest

### Requirement: CLI pack command is registered
Invoking `pack` MUST be recognized by CLI dispatch and MUST invoke a thin FEOD command → module path that calls `@bapm/core` pack APIs. Unknown flags on `pack` MUST hard-error with non-zero exit.

#### Scenario: pack is not unknown
- **WHEN** `runCli(["pack", "--help"])` or `runCli(["pack", "--archive"])` is called in a valid project context
- **THEN** the CLI MUST NOT treat `pack` as an unknown command

#### Scenario: Unknown pack flag fails
- **WHEN** `runCli(["pack", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

### Requirement: No APM plugin pack format in M7
Pack MUST NOT require Claude/marketplace `plugin.json` emission, `--format plugin` host bundles, or marketplace `--check-clean` as M7 success criteria. Those remain deferred.

#### Scenario: Default pack is plain archive not plugin format
- **WHEN** pack runs with default M7 archive options
- **THEN** the artifact MUST be a plain zip-of-tree layout and MUST NOT require host plugin.json bundles for success
