## Purpose

Defines core marketplace authoring configuration: loading and validating the
`marketplace:` block in `bapm.yml` (and legacy `marketplace.yml`), package
entry CRUD via YAML editing, and source rules aligned with OpenAPM req-mf-017
without emitting host marketplace.json artifacts.

## ADDED Requirements

### Requirement: Load marketplace authoring config from bapm.yml
The system MUST load a marketplace authoring configuration from the top-level `marketplace:` mapping in project `bapm.yml`. Unknown keys inside the `marketplace:` block MUST fail closed. When the block omits `name`, `description`, or `version`, the loader MUST inherit those fields from the top-level project manifest when present. The loader MUST parse and retain `owner`, `build` (including `tagPattern` / equivalent), and an `outputs` map (including a default Claude-oriented entry when present in templates) for forward compatibility, and MUST NOT write Claude/Codex / `.claude-plugin/` / `.agents/plugins/` marketplace.json artifacts.

#### Scenario: Load block with inherited project name
- **WHEN** `bapm.yml` has top-level `name: acme` and a `marketplace:` block without its own `name`
- **THEN** the loaded authoring config MUST expose name `acme` (or equivalent inherited identity) and MUST succeed validation of known keys

#### Scenario: Unknown key in marketplace block fails
- **WHEN** `marketplace:` contains a key outside the allowed authoring key set
- **THEN** loading MUST fail closed with a clear validation error

#### Scenario: outputs and build stored without emit
- **WHEN** a valid block includes `build.tagPattern` and `outputs.claude` (or equivalent outputs map)
- **THEN** the loaded config MUST retain those fields and MUST NOT create host marketplace.json files on disk as a side effect of load

### Requirement: PackageEntry fields and local detection
Each package entry MUST support at least: `name`, `source`, mutually exclusive `version` or `ref` when set by editors, optional `subdir`, `tag_pattern`, `include_prerelease`, and pass-through metadata fields such as `description`, `tags`, and `category`. A source beginning with `./` MUST be treated as local (`is_local`); local entries MUST skip remote reachability resolution.

#### Scenario: Local source marked local
- **WHEN** a package entry has `source: ./plugins/demo`
- **THEN** the entry MUST be classified as local and MUST NOT require network resolution for schema validation

#### Scenario: version and ref mutually exclusive on edit validation
- **WHEN** an edited entry would set both `version` and `ref`
- **THEN** validation MUST fail closed

### Requirement: Source validation aligned with req-mf-017
Authoring source strings MUST accept `owner/repo`, `host.tld/owner/repo`, `https://…` remotes, and local `./…` paths per OpenAPM **req-mf-017** / APM source rules. Sources MUST refuse path traversal `..`, userinfo, non-default ports, and query strings. Remote sources MUST be `https://` or accepted shorthand forms only. Invalid sources MUST fail at parse or edit time (not silently accepted).

#### Scenario: Reject userinfo in source
- **WHEN** a package source contains userinfo (for example `https://user:pass@host/…`)
- **THEN** validation MUST fail closed

#### Scenario: Reject relative path without ./
- **WHEN** a package source is a bare relative path without a `./` prefix (for example `plugins/demo`)
- **THEN** validation MUST fail closed for local form (local MUST use `./…`)

#### Scenario: Accept github owner/repo shorthand
- **WHEN** a package source is `acme/tools`
- **THEN** validation MUST accept it as a remote github-style shorthand

### Requirement: Detect authoring config source
The system MUST detect the authoring config source as: preferred `bapm.yml` with non-null `marketplace:`; legacy standalone `marketplace.yml`; both present → hard error; neither → actionable error pointing authors to `bapm marketplace init`. Loading a legacy-only file MAY emit a deprecation warning.

#### Scenario: Both bapm.yml block and marketplace.yml error
- **WHEN** the project has both a `marketplace:` block in `bapm.yml` and a standalone `marketplace.yml`
- **THEN** detect/load MUST fail with a hard error instructing resolution (migrate/remove one)

#### Scenario: No authoring config points to init
- **WHEN** neither `marketplace:` nor legacy `marketplace.yml` exists
- **THEN** detect/load MUST fail with a message that mentions `marketplace init` (or equivalent)

#### Scenario: Preferred bapm.yml block loads
- **WHEN** only `bapm.yml` contains a valid `marketplace:` block
- **THEN** load MUST succeed from that block

### Requirement: YAML package editor mutates bapm.yml
The system MUST support adding, updating, and removing package entries in the `marketplace:` block of `bapm.yml` (creating the packages list as needed). After a successful mutation the editor MUST re-validate the authoring config. On validation failure after write, the implementation SHOULD restore the previous file contents when an atomic/restore path is available. Writes SHOULD be atomic (temp + rename) when the platform allows.

#### Scenario: Add package then reload
- **WHEN** the editor adds a package with valid `name` and `source`
- **THEN** a subsequent load MUST include that package and validation MUST pass

#### Scenario: Remove missing package fails
- **WHEN** remove is requested for a package name that does not exist
- **THEN** the operation MUST fail closed without removing other entries

### Requirement: Init marketplace block template
The system MUST provide a template renderer that produces a `marketplace:` block including `owner`, at least one example package entry, `build.tagPattern` (or equivalent), and an `outputs` map suitable for future pack (Claude default entry allowed). Rendering MUST NOT emit host marketplace.json files.

#### Scenario: Template includes owner and example package
- **WHEN** the init template is rendered with owner `acme-org` and a project name
- **THEN** the YAML fragment MUST include `owner`, a `packages` entry, and MUST NOT write `.claude-plugin/marketplace.json`
