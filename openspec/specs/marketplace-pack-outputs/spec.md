# marketplace-pack-outputs Specification

## Purpose

Defines the core producer that turns project `marketplace:` authoring config into host Claude, Codex, and Copilot `marketplace.json` artifacts during pack — resolve, map, path-jail, and atomic multi-output write — without replacing plain-zip pack or claiming OpenAPM consumer marketplace resolution.

## Requirements

### Requirement: Resolve authoring packages to concrete refs

When emitting marketplace outputs, the system MUST load the project authoring config (same detect/load rules as authoring) and resolve each package entry to a concrete resolved form before mapping. Local sources beginning with `./` MUST pass through as path strings without network access. Remote default-host GitHub `owner/repo` entries MUST resolve via thin ambient `git ls-remote` (or equivalent) to a concrete `ref` and `sha`, respecting explicit `ref`, or `version` ranges with `build.tagPattern` / per-entry `tag_pattern`. Unlocked non-github remotes (GitHub enterprise, gitlab, ado) MUST resolve using thin env tokens and/or ambient git when available. When a remote cannot produce a concrete ref/sha (no token, unreachable host, or generic `git` kind still refused), resolve MUST fail closed with an actionable error. Resolve MUST NOT silently emit an empty `plugins` list when packages were configured.

#### Scenario: Local package skips network

- **WHEN** pack marketplace emit runs for a package with `source: ./plugins/demo`
- **THEN** resolution MUST succeed without network probes and the mapped entry MUST use the local path form

#### Scenario: GitHub shorthand resolves to sha

- **WHEN** pack marketplace emit runs online for a package with source `acme/tools` and a resolvable `ref` or matching tag from the configured tag pattern
- **THEN** the resolved package MUST include a concrete `sha` (and effective `ref`) before write

#### Scenario: Unresolvable remote fails closed

- **WHEN** resolve cannot obtain a concrete ref/sha for a configured remote package (including offline without usable cache)
- **THEN** the pack marketplace path MUST exit non-zero with an actionable error and MUST NOT write a host marketplace.json that omits that package silently

#### Scenario: Unlocked gitlab remote resolves with thin token

- **WHEN** pack marketplace emit runs for a gitlab remote package and a GitLab-class env token enables `git ls-remote` (or equivalent) to succeed
- **THEN** resolve MUST produce a concrete ref/sha and MUST NOT fail solely because hosts-auth was previously out of scope

### Requirement: Output profiles and path jail

The system MUST support at least Claude, Codex, and Copilot output profiles. Default write paths MUST be Claude → `.claude-plugin/marketplace.json`, Codex → `.agents/plugins/marketplace.json`, and Copilot → `.github/plugin/marketplace.json` relative to the project root. When `marketplace.outputs.<format>.path` is set, when the legacy `marketplace.<format>.output` key is set, or when CLI `--marketplace-path FORMAT=PATH` overrides are supplied, the effective path MUST be used. Effective paths MUST be confined under the project root (path jail); escapes MUST fail closed. Boolean or map-shaped `outputs` entries that disable a format MUST exclude that format from the emit set unless an explicit CLI filter re-enables only allowed formats.

#### Scenario: Default Claude path

- **WHEN** authoring enables Claude output without a custom path and pack emit runs
- **THEN** the Claude artifact MUST be written at `.claude-plugin/marketplace.json` under the project root

#### Scenario: Default Copilot path

- **WHEN** authoring enables Copilot output via `marketplace.outputs.copilot` without a custom path and pack emit runs
- **THEN** the Copilot artifact MUST be written at `.github/plugin/marketplace.json` under the project root

#### Scenario: Path override confined

- **WHEN** `--marketplace-path claude=nested/out/marketplace.json` is supplied with a path under the project root
- **THEN** the Claude artifact MUST be written at that relative path

#### Scenario: Copilot path escape rejected

- **WHEN** a Copilot path override would resolve outside the project root
- **THEN** pack MUST fail closed without writing that artifact or any file outside the project root

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

### Requirement: Copilot marketplace.json mapping

Copilot emit MUST produce `.github/plugin/marketplace.json` (or configured path) with a kebab-case marketplace `name`, `owner` (`name`, optional `email`), optional nested `metadata` (`description`, `version`), and `plugins` entries with `name`, optional `description`, optional display-version `version`, and `source`. Local packages MUST use a path string source. Remote GitHub shorthand packages MUST use `{ source: "github", repo }`; other remotes MUST use `{ source: "url", url }`. Remote entries MUST carry `path` when a subdirectory is configured, `ref` for non-commit refs, and a full 40-character `sha` when a commit is pinned; a short commit SHA MUST fail closed. Serialization MUST use two-space indent and a trailing newline.

#### Scenario: Copilot local plugin shape

- **WHEN** Copilot output is selected for a local `./plugins/demo` package
- **THEN** the written Copilot marketplace.json MUST contain a plugin entry whose `source` is the local path string and whose marketplace identity is normalized to kebab-case

#### Scenario: Copilot short SHA fails closed

- **WHEN** a remote Copilot package resolves to a non-40-character commit SHA
- **THEN** pack MUST exit non-zero and MUST NOT publish that Copilot marketplace.json

### Requirement: Pack --check-clean drift gate

`bapm pack --check-clean` MUST be a read-only marketplace drift gate with APM semantics: regenerate every selected marketplace output in memory using the same resolver/mappers, then semantically compare each document with the effective on-disk path (including `--marketplace-path` overrides). It MUST NOT write marketplace.json, a zip, or any other pack artifact. `unchanged` outputs pass; `missing` or `drift` outputs MUST exit with code `4`. When no marketplace authoring block exists the gate MUST skip with exit code `0`. When combined with `--check-versions`, a version-alignment failure (exit `3`) MUST take precedence over drift.

#### Scenario: Clean output passes

- **WHEN** `pack --check-clean` runs and the committed marketplace.json equals the regenerated document
- **THEN** the command MUST exit `0` and MUST not modify the file

#### Scenario: Drift fails with exit 4

- **WHEN** `pack --check-clean` regenerates a document that differs from the on-disk marketplace.json or the file is missing
- **THEN** the command MUST exit `4`, report the drift, and MUST NOT write any artifact

#### Scenario: No marketplace block skips

- **WHEN** `pack --check-clean` runs on a project without a `marketplace:` block
- **THEN** the command MUST skip the gate and exit `0`

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

### Requirement: PackOutputs git resolve uses ambient credential suppress

When PackOutputs remote resolve spawns git (`ls-remote`, fetch, or equivalent) for non-local package entries, the child environment MUST follow the git-ambient-suppress capability: suppress ambient unselected-class tokens, clear inherited Auth git config, attach only selected-class credentials when scheme policy allows, and refuse non-https git-HTTP attach except loopback / insecure exemption.

#### Scenario: PackOutputs ls-remote suppresses ambient GitHub token for ado remote

- **WHEN** PackOutputs resolves an ado-class remote while `GITHUB_TOKEN` is set in the parent environment
- **THEN** the git child MUST NOT inherit the GitHub token for credential use

### Requirement: Claude, Codex, and Copilot marketplace outputs have explicit integration owners

Claude marketplace output MUST be provided by `@b-apm/integration-claude`, Codex marketplace output MUST be provided by `@b-apm/integration-codex`, and Copilot marketplace output MUST be provided by `@b-apm/integration-copilot`. `@b-apm/integration-claude` MUST continue to own Claude marketplace mapping and MAY also expose Claude runtime capabilities in the same package without removing marketplace-output selection. `@b-apm/integration-codex` MUST continue to own Codex marketplace mapping and MAY also expose Codex runtime capabilities in the same package without removing marketplace-output selection. `@b-apm/integration-copilot` MUST continue to own Copilot runtime capabilities and MAY additionally expose the Copilot marketplace-output mapper without changing that runtime behavior. Each marketplace owner MUST own its host-specific JSON mapping, default path, validation, and output metadata; `@b-apm/core` MUST provide only generic resolution, selection, atomic-write orchestration, and integration capability invocation. The CLI composition root MUST NOT eagerly static-register Claude, Codex, or Copilot marketplace-output integrations at registry construction. When pack’s effective format selection includes any of these formats, the composition path MUST dynamically resolve and register the corresponding package for that run when it is resolvable; if the package cannot be resolved or does not expose marketplace-output capability, pack MUST fail closed with guidance to install the integration package.

#### Scenario: Claude output is selected

- **WHEN** pack selects Claude marketplace output and `@b-apm/integration-claude` resolves with marketplace-output capability
- **THEN** the Claude integration supplies the Claude-shaped document and default path through the generic integration capability contract

#### Scenario: Codex output is selected

- **WHEN** pack selects Codex marketplace output and `@b-apm/integration-codex` resolves with marketplace-output capability
- **THEN** the Codex integration supplies the Codex-shaped document, category validation, and default path through the generic integration capability contract

#### Scenario: Missing Claude package fails closed

- **WHEN** pack selects Claude marketplace output and `@b-apm/integration-claude` cannot be resolved
- **THEN** pack MUST exit non-zero with guidance to install the Claude integration package and MUST NOT write a Claude marketplace.json as if a built-in emitter existed

#### Scenario: Claude package may also expose runtime

- **WHEN** `@b-apm/integration-claude` exposes both marketplace-output and runtime capabilities
- **THEN** pack MUST still be able to select marketplace-output without requiring runtime detect/materialize activation for that pack run

#### Scenario: Codex package may also expose runtime

- **WHEN** `@b-apm/integration-codex` exposes both marketplace-output and runtime capabilities
- **THEN** pack MUST still be able to select marketplace-output without requiring runtime detect/materialize activation for that pack run

#### Scenario: Copilot output is selected

- **WHEN** pack selects Copilot marketplace output and `@b-apm/integration-copilot` resolves with marketplace-output capability
- **THEN** the Copilot integration supplies the Copilot-shaped document and `.github/plugin/marketplace.json` default path through the generic integration capability contract

#### Scenario: Missing Copilot package fails closed

- **WHEN** pack selects Copilot marketplace output and `@b-apm/integration-copilot` cannot be resolved
- **THEN** pack MUST exit non-zero with guidance to install the Copilot integration package and MUST NOT write a Copilot marketplace.json as if a built-in emitter existed

### Requirement: Marketplace outputs do not require runtime integration capabilities

Marketplace-output integrations MUST be selectable independently of runtime detection, deploy, MCP, and compile capabilities. A project that emits only marketplace artifacts MUST NOT require a Cursor or other runtime integration to be installed or registered. Selecting Claude/Codex/Copilot marketplace emit MUST still require the corresponding marketplace-output integration package to be installed and loadable for that run (not eager CLI built-ins). When a package exposes both marketplace-output and runtime (Claude, Codex, or Copilot), pack MUST use the marketplace capability path and MUST NOT require invoking runtime hooks.

#### Scenario: Pack uses a marketplace-only integration

- **WHEN** pack runs with only Codex marketplace output enabled and `@b-apm/integration-codex` is resolvable
- **THEN** it succeeds by selecting the Codex integration output capability without activating a runtime target

#### Scenario: Pack uses Codex marketplace while runtime exists on package

- **WHEN** pack runs with only Codex marketplace output enabled and `@b-apm/integration-codex` is resolvable and also exports a runtime factory
- **THEN** it succeeds by selecting the Codex integration output capability without activating a runtime target and without calling Codex `detect` / `materialize` / `configureMcp` / `compile`

#### Scenario: Pack uses Claude marketplace while runtime exists on package

- **WHEN** pack runs with Claude marketplace output enabled and `@b-apm/integration-claude` also exports a runtime factory
- **THEN** pack MUST succeed using marketplace-output capability without calling Claude `detect` / `materialize` / `configureMcp` / `compile`
