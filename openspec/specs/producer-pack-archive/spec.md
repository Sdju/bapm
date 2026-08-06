# producer-pack-archive Specification

## Purpose

Builds and round-trips a plain-zip producer archive containing a conforming manifest, refusing secret-pattern paths and failing closed on schema validation errors.

## Requirements

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
Pack MUST NOT require APM `--format plugin` host directory bundles, tar plugin layouts, or marketplace `--check-clean` / `--check-versions` as M7 success criteria. Optional emission of external host `marketplace.json` files (Claude/Codex paths) when authoring `marketplace:` outputs are selected is allowed and orthogonal to plain-zip success. Those JSON files MUST NOT be treated as OpenAPM normative consumer marketplace resolution claims.

#### Scenario: Default pack is plain archive not plugin format
- **WHEN** pack runs with default M7 archive options on a project without marketplace outputs
- **THEN** the artifact MUST be a plain zip-of-tree layout and MUST NOT require host plugin directory bundles for success

#### Scenario: Marketplace JSON does not replace plain zip semantics
- **WHEN** pack runs with both archive mode and selected marketplace outputs on a packable project
- **THEN** the zip artifact MUST still follow M7 plain-zip rules and marketplace.json MUST be written as separate project-root (or jailed) host paths

### Requirement: Pack emits host marketplace.json when authoring outputs selected
When the project has a loadable `marketplace:` authoring config and the effective output selection includes Claude and/or Codex, `bapm pack` MUST invoke marketplace pack emit and write the corresponding host `marketplace.json` artifact(s) under the project root (or configured jailed paths). Plain-zip archive production MUST remain available and MUST NOT be replaced by host JSON emit. Host marketplace.json paths are project-tree artifacts; pack MUST NOT treat nesting marketplace.json inside the zip as the only distribution mechanism for those hosts.

#### Scenario: Pack with marketplace writes Claude JSON and zip
- **WHEN** `runCli(["pack", "--archive"])` runs on a conforming project that also has `marketplace:` with Claude output enabled and resolvable packages
- **THEN** exit code MUST be `0`, a plain zip MUST exist per M7 rules, and `.claude-plugin/marketplace.json` (or configured Claude path) MUST exist on disk

#### Scenario: Pack without marketplace still zips
- **WHEN** pack `--archive` runs on a conforming project with no `marketplace:` block
- **THEN** a plain zip MUST still be produced and no Claude/Codex marketplace.json MUST be required for success

### Requirement: Marketplace-only pack skips empty zip
When `marketplace:` is present, marketplace outputs are selected, and the project has no packable producer content warranting a zip (marketplace-authoring-only intent / empty pack set relative to M7 archive rules), pack MUST emit the selected host marketplace.json artifact(s) and MUST NOT write an empty or minimal placeholder zip solely to satisfy archive mode.

#### Scenario: Marketplace-only project emits JSON without zip
- **WHEN** pack runs against a project whose only meaningful producer intent is `marketplace:` outputs (no packable dual-read project tree for zip)
- **THEN** selected marketplace.json file(s) MUST be written and no empty/minimal zip MUST be required as success output

### Requirement: Pack marketplace CLI flags
`bapm pack` MUST accept `--marketplace` (`all` | `none` | comma-separated format list), repeatable `--marketplace-path FORMAT=PATH`, and marketplace-aware `--offline`. Unknown pack flags MUST still fail closed. Pack help MUST document marketplace emit mode. Existing `--archive`, `--dry-run`, `--check-release`, and `--tag` behaviors MUST remain; sc-007 secret refuse and pr-004 `--check-release` MUST NOT regress.

#### Scenario: Pack help mentions marketplace
- **WHEN** `runCli(["pack", "--help"])` is invoked after this change
- **THEN** help text MUST mention marketplace output flags or emit behavior

#### Scenario: Unknown pack flag still fails
- **WHEN** `runCli(["pack", "--not-a-real-flag"])` is called
- **THEN** the return code MUST be non-zero and stderr MUST mention the unknown flag

#### Scenario: Dry-run skips durable zip and marketplace JSON
- **WHEN** pack runs with `--dry-run` on a project that would otherwise write zip and marketplace.json
- **THEN** neither a durable zip nor durable marketplace.json MUST remain as published output

### Requirement: Pack remains distinct from registry publish flat zip
M7 plain pack archive semantics MUST remain unchanged as the producer pack product. Registry publish builds a separate **flat** APM-wire zip (see `producer-publish`). Pack MAY share low-level zip create/extract helpers with publish but MUST NOT be rewritten into the registry publish layout or require registry HTTP.

#### Scenario: Pack archive mode still produces M7 plain zip
- **WHEN** `pack --archive` runs on a conforming project after M10
- **THEN** the artifact MUST follow M7 plain-zip producer-pack rules and MUST NOT require a registry PUT

#### Scenario: Publish does not replace pack command
- **WHEN** both `pack` and `publish` are available
- **THEN** each MUST remain independently invocable with its own flag surface
