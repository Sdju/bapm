# marketplace-models Specification

## Purpose

Defines immutable marketplace source and plugin/manifest models and the
JSON parser that accepts Copilot and Claude `marketplace.json` shapes so
downstream registry and fetch layers share one validated representation.

## Requirements

### Requirement: MarketplaceSource URL-first model
The system MUST represent a registered marketplace as an immutable source with at least `name`, `url`, `ref` (default `main`), and `path` (default `marketplace.json`, or empty for a direct remote manifest URL). Legacy mirror fields `owner`, `repo`, `host`, and `branch` MAY be synthesized from or into `url`/`ref` for APM-compatible serialization. Source kind MUST be derived as one of `local` | `url` | `github` | `gitlab` | `ado` | `git` using path/URL heuristics: local path or `file://` → `local`; direct HTTPS path ending in `/marketplace.json` with empty `path` → `url`; otherwise host classification (github.com → `github`; other hosts remain classifiable for refuse-at-fetch).

#### Scenario: OWNER/REPO synthesizes github URL
- **WHEN** a source is constructed with name and legacy owner/repo (or equivalent shorthand fields) without an explicit url
- **THEN** the model MUST expose a canonical HTTPS github URL (host default `github.com`) and derived kind `github`

#### Scenario: Direct marketplace.json URL is kind url
- **WHEN** a source has an HTTPS URL whose path ends with `/marketplace.json` and `path` is empty
- **THEN** derived kind MUST be `url` and remote-manifest detection MUST be true

#### Scenario: Local path or file URI is kind local
- **WHEN** a source url is an absolute/relative filesystem path, `~` path, or `file://` URI
- **THEN** derived kind MUST be `local`

### Requirement: MarketplacePlugin and MarketplaceManifest
The system MUST represent each plugin with `name`, `source` (string or structured object), optional `description`, `version`, `tags`, optional `registry` string, and optional `tag_pattern`. A manifest MUST hold marketplace `name`, ordered plugins, and optional metadata fields (`owner_name`, `description`, `plugin_root`). Manifest MUST support exact case-insensitive plugin lookup by name. Search-by-query helpers MAY exist but MUST NOT be required by consumer CLI in this change.

#### Scenario: Find plugin by name case-insensitive
- **WHEN** a manifest contains a plugin named `Foo` and a caller looks up `foo`
- **THEN** the lookup MUST return that plugin entry

### Requirement: Parse Copilot and Claude marketplace.json
Parsing MUST accept Copilot-style plugin entries (`repository` as `owner/repo`, optional `ref`) and Claude-style entries (`source` as relative string or typed object). Entries with npm source type MUST be skipped. Plugins lacking both `source` and `repository` MUST be skipped. A non-empty `registry` field MUST be parsed as a string; malformed `registry` (non-string / empty when present) MUST fail closed for that parse. When `registry` is set, a missing version selector MUST fail closed. Parsed `registry` MUST be retained on the plugin model even though install routing is out of scope for this change.

#### Scenario: Copilot repository entry parses to github source
- **WHEN** JSON contains a plugin with `"repository": "acme/tools"` and a name
- **THEN** parse MUST produce a plugin whose source is a github-typed object for `acme/tools`

#### Scenario: Claude npm source skipped
- **WHEN** a plugin entry declares source type `npm`
- **THEN** parse MUST omit that plugin from the manifest without failing the whole document

#### Scenario: Malformed registry field fails closed
- **WHEN** a plugin entry sets `registry` to a non-string or empty string
- **THEN** parse MUST raise a clear validation error for that document
