## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: No APM plugin pack format in M7
Pack MUST NOT require APM `--format plugin` host directory bundles, tar plugin layouts, or marketplace `--check-clean` / `--check-versions` as M7 success criteria. Optional emission of external host `marketplace.json` files (Claude/Codex paths) when authoring `marketplace:` outputs are selected is allowed and orthogonal to plain-zip success. Those JSON files MUST NOT be treated as OpenAPM normative consumer marketplace resolution claims.

#### Scenario: Default pack is plain archive not plugin format
- **WHEN** pack runs with default M7 archive options on a project without marketplace outputs
- **THEN** the artifact MUST be a plain zip-of-tree layout and MUST NOT require host plugin directory bundles for success

#### Scenario: Marketplace JSON does not replace plain zip semantics
- **WHEN** pack runs with both archive mode and selected marketplace outputs on a packable project
- **THEN** the zip artifact MUST still follow M7 plain-zip rules and marketplace.json MUST be written as separate project-root (or jailed) host paths
