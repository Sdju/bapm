## Purpose

Defines the core producer that turns project `marketplace:` authoring config into host Claude and Codex `marketplace.json` artifacts during pack — resolve, map, path-jail, and atomic multi-output write — without replacing plain-zip pack or claiming OpenAPM consumer marketplace resolution.

## ADDED Requirements

### Requirement: Resolve authoring packages to concrete refs
When emitting marketplace outputs, the system MUST load the project authoring config (same detect/load rules as authoring) and resolve each package entry to a concrete resolved form before mapping. Local sources beginning with `./` MUST pass through as path strings without network access. Remote default-host GitHub `owner/repo` entries MUST resolve via thin ambient `git ls-remote` (or equivalent) to a concrete `ref` and `sha`, respecting explicit `ref`, or `version` ranges with `build.tagPattern` / per-entry `tag_pattern`. Non-github remotes without hosts-auth support MUST fail closed with an actionable error (or an explicit documented skip policy that still fails the build when no concrete ref/sha can be produced). Resolve MUST NOT silently emit an empty `plugins` list when packages were configured.

#### Scenario: Local package skips network
- **WHEN** pack marketplace emit runs for a package with `source: ./plugins/demo`
- **THEN** resolution MUST succeed without network probes and the mapped entry MUST use the local path form

#### Scenario: GitHub shorthand resolves to sha
- **WHEN** pack marketplace emit runs online for a package with source `acme/tools` and a resolvable `ref` or matching tag from the configured tag pattern
- **THEN** the resolved package MUST include a concrete `sha` (and effective `ref`) before write

#### Scenario: Unresolvable remote fails closed
- **WHEN** resolve cannot obtain a concrete ref/sha for a configured remote package (including offline without usable cache)
- **THEN** the pack marketplace path MUST exit non-zero with an actionable error and MUST NOT write a host marketplace.json that omits that package silently

### Requirement: Output profiles and path jail
The system MUST support at least Claude and Codex output profiles. Default write paths MUST be Claude → `.claude-plugin/marketplace.json` and Codex → `.agents/plugins/marketplace.json` relative to the project root. When `marketplace.outputs.<format>.path` is set, or when CLI `--marketplace-path FORMAT=PATH` overrides are supplied, the effective path MUST be used. Effective paths MUST be confined under the project root (path jail); escapes MUST fail closed. Boolean or map-shaped `outputs` entries that disable a format MUST exclude that format from the emit set unless an explicit CLI filter re-enables only allowed formats.

#### Scenario: Default Claude path
- **WHEN** authoring enables Claude output without a custom path and pack emit runs
- **THEN** the Claude artifact MUST be written at `.claude-plugin/marketplace.json` under the project root

#### Scenario: Path override confined
- **WHEN** `--marketplace-path claude=nested/out/marketplace.json` is supplied with a path under the project root
- **THEN** the Claude artifact MUST be written at that relative path

#### Scenario: Path escape rejected
- **WHEN** a marketplace path override would resolve outside the project root
- **THEN** pack MUST fail closed without writing that artifact

### Requirement: Claude marketplace.json mapping
Claude emit MUST produce Anthropic-shaped JSON: top-level marketplace identity fields (`name`, `owner`, and optional description/version/metadata when present), and a `plugins` array derived from resolved packages. APM-only authoring fields MUST be stripped from the emitted document. Remote plugins MUST use source objects appropriate to github / url / git-subdir forms with concrete `ref`/`sha` as applicable; local plugins MUST use a path string source. Serialization MUST use two-space indent and a trailing newline.

#### Scenario: Claude plugins from packages
- **WHEN** Claude output is selected and packages resolve successfully
- **THEN** the written `.claude-plugin/marketplace.json` (or configured path) MUST contain a `plugins` array whose entries correspond to those packages without authoring-only keys such as `tag_pattern` or `include_prerelease`

### Requirement: Codex marketplace.json mapping
Codex emit MUST produce `.agents/plugins/marketplace.json` (or configured path) with marketplace `name`, `interface.displayName` (or equivalent display interface), and `plugins` entries that include `source`, `policy`, and **`category`**. If any selected Codex package lacks `category`, emit MUST fail closed before durable write. Serialization MUST use two-space indent and a trailing newline.

#### Scenario: Missing Codex category fails
- **WHEN** Codex output is selected and a package entry has no `category`
- **THEN** pack MUST exit non-zero and MUST NOT leave a durable Codex marketplace.json from that failed run

#### Scenario: Codex category present succeeds
- **WHEN** Codex output is selected and every package has a `category`
- **THEN** the written Codex marketplace.json MUST include those categories on plugin entries

### Requirement: Atomic multi-output write and dry-run
For each selected output format after a single resolve pass, the system MUST write marketplace.json atomically (temp + rename when the platform allows) and create parent directories as needed. When `--dry-run` is set, the system MUST report the paths that would be written and MUST NOT leave durable marketplace.json artifacts. Selection MUST honor `marketplace.outputs` and the CLI `--marketplace` filter values `all`, `none`, or a comma-separated format list; unknown format names MUST fail closed. `--marketplace none` MUST skip host JSON emit even when a `marketplace:` block is present.

#### Scenario: Dry-run reports without write
- **WHEN** pack runs with marketplace outputs selected and `--dry-run`
- **THEN** the command MUST indicate the would-write marketplace path(s) and MUST NOT create durable marketplace.json files

#### Scenario: marketplace none skips JSON
- **WHEN** a project has `marketplace:` with Claude enabled and pack runs with `--marketplace none`
- **THEN** no host marketplace.json MUST be written by that run

#### Scenario: Unknown marketplace format fails
- **WHEN** pack is invoked with `--marketplace` listing an unknown format name
- **THEN** the exit code MUST be non-zero and no marketplace.json MUST be written for that invalid selection

### Requirement: Offline marketplace resolve is fail-closed
When marketplace emit needs network resolve and `--offline` is set (or network resolve is otherwise unavailable) and no concrete ref/sha can be obtained without network, the system MUST fail closed with a non-zero exit and an actionable error. Offline MUST NOT reuse stale on-disk marketplace.json as a silent success substitute for missing refs.

#### Scenario: Offline without resolvable refs fails
- **WHEN** pack marketplace emit runs with `--offline` against remote packages that still need live resolve
- **THEN** exit MUST be non-zero and durable host marketplace.json MUST NOT be published as success for that run
