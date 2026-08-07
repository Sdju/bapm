# marketplace-plugin-resolve Specification

## Purpose

Defines parsing of `NAME@MARKETPLACE[#ref]` marketplace dependency references and resolving registered marketplace plugins into concrete installable dependency coordinates with provenance metadata for lock write-back.

## Requirements

### Requirement: Parse marketplace ref strings

The system MUST parse a marketplace dependency string matching the intent of `^([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+)(?:#(.+))?$` into `(pluginName, marketplaceName, ref|null)`. Strings that do not match MUST yield a null/non-match result (not a hard throw solely for non-match). A matched `#ref` that contains semver-range characters among `~^<>=!` MUST be rejected with a clear error. Specs containing `/` or `:` before `#` MUST NOT be treated as marketplace refs by this parser.

#### Scenario: Basic NAME@MARKETPLACE parses

- **WHEN** `tools@acme` is parsed as a marketplace ref
- **THEN** the result MUST be plugin `tools`, marketplace `acme`, and null/absent ref

#### Scenario: Ref fragment accepted without range chars

- **WHEN** `tools@acme#v1.2.3` is parsed
- **THEN** the result MUST include ref `v1.2.3`

#### Scenario: Semver-range chars in ref rejected

- **WHEN** `tools@acme#^1.0.0` (or a ref containing `~`, `<`, `>`, `=`, or `!`) is parsed
- **THEN** parsing MUST fail with a clear error naming the invalid ref

#### Scenario: Path-like specs are not marketplace refs

- **WHEN** a string such as `owner/repo#main` or a URL with `:` before `#` is offered to the marketplace ref parser
- **THEN** the parser MUST return a non-match (null) rather than a marketplace triple

### Requirement: Resolve marketplace plugin to concrete dependency

Given a registered marketplace alias, plugin name, and optional version/ref selector, the system MUST load the marketplace source from the `~/.bapm` local registry (test-overridable config dir), fetch/parse the marketplace manifest via the existing marketplace fetch/cache path, locate the plugin by case-insensitive name, and map the plugin source into a concrete dependency declaration the existing resolver already understands (`git` / `local` path forms, or equivalent structured refs). Resolution MUST attach provenance identifying at least the marketplace alias (`discovered_via`) and the plugin name (`marketplace_plugin_name`), and MUST include `source_url` / `source_digest` when those fields are present on the fetched marketplace/plugin metadata. Missing marketplace, missing plugin, or fetch failure MUST fail with clear dedicated errors and MUST NOT silently treat the miss as a bare git `owner/repo` install.

#### Scenario: Local marketplace relative plugin resolves

- **WHEN** a local marketplace is registered under `~/.bapm` and contains plugin `demo` with a relative local source
- **THEN** resolve MUST return a concrete local dependency path under that marketplace tree plus provenance naming the marketplace alias and plugin

#### Scenario: Github-shaped plugin maps to git coordinates

- **WHEN** a fetched marketplace lists a plugin whose source is a github `owner/repo` (or Copilot `repository`) form with optional ref
- **THEN** resolve MUST return concrete git coordinates suitable for the existing git install path and MUST attach marketplace provenance

#### Scenario: Unknown marketplace fails clearly

- **WHEN** resolve is asked for a marketplace alias absent from the local registry
- **THEN** it MUST fail with a marketplace-not-found style error and MUST NOT fall back to git/registry lookup of the alias

#### Scenario: Unknown plugin fails clearly

- **WHEN** the marketplace is registered and fetched but the plugin name is absent
- **THEN** it MUST fail with a plugin-not-found style error

### Requirement: Unsupported plugin source fails closed

Happy-path v1 plugin sources MUST be github-shaped dict / Copilot repository, local relative path under a local marketplace, and HTTPS git/url coordinates the existing git resolver already handles. Plugin entries that are only registry-routed (`registry` field without an installable github/local/url source), or that require unsupported host patterns (gitlab/ado/enterprise cross-repo gates), MUST fail with a clear unsupported-source (or deferred) error. The system MUST NOT invent new marketplace **source** fetchers and MUST NOT silently route registry-only plugins through Registry HTTP in this change.

#### Scenario: Registry-only plugin deferred

- **WHEN** a plugin entry has a non-empty `registry` field and no installable github/local/url source coordinates
- **THEN** resolve MUST fail with a clear unsupported/deferred message and MUST NOT call the package Registry HTTP client as a silent fallback

#### Scenario: Unsupported host pattern refused

- **WHEN** a plugin source requires a gitlab/ado (or similarly unsupported) install host pattern outside v1 happy path
- **THEN** resolve MUST fail with a clear unsupported-source error
