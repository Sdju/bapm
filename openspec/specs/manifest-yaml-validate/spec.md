# manifest-yaml-validate Specification

## Purpose

Loads YAML safely and validates OpenAPM/APM project manifests for M1: required fields, dependency and registry shapes, extensions, and YAML safe-subset rejection—without resolve, lock, or install.

## Requirements

### Requirement: Top-level document must be a mapping
The system MUST reject a YAML document whose root is not a mapping (object). Invalid YAML MUST fail with a diagnostic that identifies the source.

#### Scenario: Mapping root accepted
- **WHEN** a YAML document with a mapping root containing valid `name` and `version` is loaded
- **THEN** the system MUST accept it (OpenAPM req-mf-001)

#### Scenario: Non-mapping root rejected
- **WHEN** a YAML document whose root is a list or scalar is loaded
- **THEN** the system MUST reject it with a diagnostic indicating a YAML object/mapping was required

#### Scenario: Invalid YAML syntax rejected
- **WHEN** the file contents are not valid YAML
- **THEN** the system MUST reject the load with a parse error diagnostic

### Requirement: name and version are required non-empty strings
The system MUST require `name` and `version` as present, non-empty strings. Numeric YAML scalars for these fields MUST be rejected (callers must quote semver-looking numbers).

#### Scenario: Minimal valid name and version
- **WHEN** a mapping provides non-empty string `name` and `version`
- **THEN** the system MUST accept the manifest (req-mf-002, req-mf-003)

#### Scenario: Missing name rejected
- **WHEN** `name` is absent
- **THEN** the system MUST reject the manifest (req-mf-002)

#### Scenario: Missing version rejected
- **WHEN** `version` is absent
- **THEN** the system MUST reject the manifest (req-mf-003)

#### Scenario: Empty name rejected
- **WHEN** `name` is present as an empty string
- **THEN** the system MUST reject the manifest

#### Scenario: Numeric version rejected
- **WHEN** `version` is a YAML number (unquoted) rather than a string
- **THEN** the system MUST reject the manifest

### Requirement: Semver diagnostic is non-blocking
The system SHOULD emit a non-blocking warning when `version` is not semver-shaped, but MUST NOT reject solely for that reason (req-mf-004).

#### Scenario: Non-semver version still loads
- **WHEN** `version` is a non-empty string that is not semver
- **THEN** the system MUST accept the manifest and MAY attach a warning diagnostic

### Requirement: dependencies and devDependencies must be mappings when present
If `dependencies` or `devDependencies` is present, its value MUST be a mapping; otherwise the system MUST reject.

#### Scenario: dependencies mapping accepted
- **WHEN** `dependencies` is a mapping (possibly with `apm` / `mcp` / `lsp` keys)
- **THEN** the system MUST accept that shape for parse-time validation

#### Scenario: dependencies not a mapping rejected
- **WHEN** `dependencies` is a list or scalar
- **THEN** the system MUST reject the manifest

### Requirement: APM dependency entries are string or object form
Under dependency list keys used for APM packages (at least `apm`), each entry MUST be either a string reference or a mapping object. The system MUST parse string-form deps and object-form deps without resolving them (req-mf-007).

#### Scenario: String dependency parsed
- **WHEN** an `apm` dependency entry is a string such as `owner/repo#v1.0.0`
- **THEN** the system MUST accept and retain a structured or validated string-form representation (no network resolve)

#### Scenario: Object dependency with single git source
- **WHEN** an object dependency provides exactly one source discriminator `git`
- **THEN** the system MUST accept it (parse only)

#### Scenario: Object dependency with path source
- **WHEN** an object dependency provides exactly one source discriminator `path`
- **THEN** the system MUST accept it (parse only)

#### Scenario: Object dependency with id and version
- **WHEN** an object dependency provides `id` (and optional `version` / `ref` fields as allowed by OpenAPM)
- **THEN** the system MUST accept the shape without resolving (req-mf-008, req-mf-009)

#### Scenario: git parent sentinel with path accepted
- **WHEN** an object dependency uses `git: parent` together with a non-empty `path`
- **THEN** the system MUST accept the shape; expansion of the sentinel is out of M1 (req-mf-010)

#### Scenario: bare git parent without path rejected
- **WHEN** an object dependency uses `git: parent` without a `path` field
- **THEN** the system MUST reject it (APM requires `path` for parent inheritance)

### Requirement: Object dependency source discriminators
An object dependency MUST have exactly one of `git` | `id` | `path` | `registry` as its source kind. The system MUST reject missing source, unknown source kind, and simultaneous `id` and `git` (req-mf-011, req-mf-012). The field `path` MAY accompany `git` as a virtual_path companion (virtual package / monorepo sibling) and MUST NOT count as a second source kind in that case. Meta fields such as `alias`, `ref`, `version`, and optionally `skills` / `targets` MUST NOT be treated as unknown source kinds.

#### Scenario: No source key rejected
- **WHEN** an object dependency has none of `git`, `id`, `path`, or `registry`
- **THEN** the system MUST reject it

#### Scenario: Unknown source kind rejected
- **WHEN** an object dependency uses an unknown source kind key in place of a valid discriminator
- **THEN** the system MUST reject it (req-mf-012)

#### Scenario: id and git together rejected
- **WHEN** an object dependency provides both `id` and `git`
- **THEN** the system MUST reject it (req-mf-011)

#### Scenario: git with path companion accepted
- **WHEN** an object dependency provides `git` and a non-empty companion `path`
- **THEN** the system MUST accept it as a single git source with virtual path (APM virtual package form)

#### Scenario: alias meta on object dependency accepted
- **WHEN** an object dependency provides a valid source plus `alias`
- **THEN** the system MUST accept and retain `alias` (not treat it as an unknown source kind)

### Requirement: Registries parse-time validation
When a `registries` block is present, the system MUST validate registry entries for http(s) URL scheme and MUST reject unknown keys inside registry entries and tokens embedded in YAML when APM/OpenAPM rules require it (req-mf-014, req-mf-015). The key `registries.default` is a special-case name pointer: it MUST NOT be validated as a registry URL; when present it MUST be a non-empty string naming a declared registry entry.

#### Scenario: Valid https registry accepted
- **WHEN** a registry entry provides an https URL with allowed keys only
- **THEN** the system MUST accept the registries block

#### Scenario: registries.default names declared registry
- **WHEN** `registries` includes named entries and `default: <name>` where `<name>` is one of those entries
- **THEN** the system MUST accept the block and retain `default`

#### Scenario: registries.default refers to missing registry
- **WHEN** `registries.default` names a registry that is not declared in the block
- **THEN** the system MUST reject the manifest

#### Scenario: Typo registry key rejected
- **WHEN** a registry entry contains an unknown/typo key
- **THEN** the system MUST reject it (req-mf-015)

#### Scenario: Non-http(s) scheme rejected
- **WHEN** a registry URL uses a non-http(s) scheme (for example `ftp:`)
- **THEN** the system MUST reject it (req-mf-014)

### Requirement: Unknown top-level keys and x-* extensions
On read, the system MUST accept unknown top-level keys and `x-*` extension keys without failing validation. The in-memory document model MUST retain them for a future rewrite path (req-ext-001, req-ext-002 policy: bapm MUST NOT define normative `x-*` keys). Rewrite preserve (req-mf-006) is deferred past M1.

#### Scenario: Unknown top-level key accepted
- **WHEN** a valid minimal manifest also contains an unrecognized top-level key
- **THEN** the system MUST accept the load and retain the key on the document model

#### Scenario: x-extension accepted
- **WHEN** a manifest includes `x-*` keys and optional `default_host` (req-mf-019)
- **THEN** the system MUST accept the load and retain those fields on the document model

### Requirement: workspaces key rejected on v0.1 parse
The system MUST reject or error when a v0.1 manifest declares `workspaces` (req-mf-021).

#### Scenario: workspaces present rejected
- **WHEN** the document contains a top-level `workspaces` key
- **THEN** the system MUST reject the manifest for OpenAPM v0.1

### Requirement: YAML safe subset rejects anchors and aliases
The system MUST reject YAML anchors (`&`) and aliases (`*`) and MUST reject custom tags (OpenAPM req-mf-020). This is intentionally stricter than APM's budgeted SafeLoader when APM would accept anchors within an expansion budget.

#### Scenario: Anchor and alias rejected
- **WHEN** a manifest YAML uses an anchor and alias reference
- **THEN** the system MUST reject the document (even if APM's loader would sometimes accept it)

#### Scenario: Custom tags rejected
- **WHEN** a manifest YAML uses a custom/non-standard tag
- **THEN** the system MUST reject the document

### Requirement: Mutual exclusion of target and targets
If both `target` and `targets` are present, the system MUST reject the manifest at parse time. Full target enum semantics are out of M1.

#### Scenario: Both target and targets rejected
- **WHEN** the document contains both `target` and `targets`
- **THEN** the system MUST reject the manifest

### Requirement: M1 does not perform resolve lock or install
Successful parse/validate MUST NOT download dependencies, write lockfiles, or install packages.

#### Scenario: Local path deps remain unresolved
- **WHEN** a real project manifest with local `path:` dependencies is loaded successfully
- **THEN** the model MUST contain those dependency declarations and MUST NOT materialize or fetch them
