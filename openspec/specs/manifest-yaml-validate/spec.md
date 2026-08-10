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

#### Scenario: Object dependency with local source accepted at parse

- **WHEN** an object dependency provides exactly one source discriminator `local`
- **THEN** the system MUST accept it (parse only); expansion of default vs custom path is out of pure parse

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

An object dependency MUST have exactly one of `git` | `id` | `path` | `registry` | `marketplace` | `local` as its source kind. The system MUST reject missing source, unknown source kind, and simultaneous `id` and `git` (req-mf-011, req-mf-012). The field `path` MAY accompany `git` as a virtual_path companion (virtual package / monorepo sibling) and MUST NOT count as a second source kind in that case. The field `local` MUST NOT accompany `git` as a virtual_path substitute. Meta fields such as `alias`, `ref`, `version`, and optionally `skills` / `targets` MUST NOT be treated as unknown source kinds.

#### Scenario: No source key rejected

- **WHEN** an object dependency has none of `git`, `id`, `path`, `registry`, `marketplace`, or `local`
- **THEN** the system MUST reject it

#### Scenario: Unknown source kind rejected

- **WHEN** an object dependency uses an unknown source kind key in place of a valid discriminator
- **THEN** the system MUST reject it (req-mf-012)

#### Scenario: id and git together rejected

- **WHEN** an object dependency provides both `id` and `git`
- **THEN** the system MUST reject it (req-mf-011)

#### Scenario: local and path together rejected

- **WHEN** an object dependency provides both `local` and `path`
- **THEN** the system MUST reject it

#### Scenario: git with path companion accepted

- **WHEN** an object dependency provides `git` and a non-empty companion `path`
- **THEN** the system MUST accept it as a single git source with virtual path (APM virtual package form)

#### Scenario: alias meta on object dependency accepted

- **WHEN** an object dependency provides a valid source plus `alias`
- **THEN** the system MUST accept and retain `alias` (not treat it as an unknown source kind)

### Requirement: Object dependency with local source

When an object APM dependency provides exactly one source discriminator `local`, the system MUST accept it at parse time without resolving (bapm extension). Allowed `local` values at parse time are: boolean `true`, `null`/empty (YAML null or empty string), or a non-empty string path. Boolean `false` and non-string/non-null/non-bool types MUST be rejected.

#### Scenario: Object dependency with default local source

- **WHEN** an object dependency provides exactly one source discriminator `local` with value `true`, `null`, or empty string
- **THEN** the system MUST accept it (parse only)

#### Scenario: Object dependency with custom local path

- **WHEN** an object dependency provides exactly one source discriminator `local` with a non-empty string value
- **THEN** the system MUST accept it (parse only)

#### Scenario: Invalid local value rejected

- **WHEN** an object dependency sets `local` to `false` or a non-scalar unsupported type
- **THEN** the system MUST reject it

### Requirement: Registries parse-time validation

When a `registries` block is present, the system MUST validate registry entries for http(s) URL scheme and MUST reject unknown keys inside registry entries and tokens embedded in YAML when APM/OpenAPM rules require it (req-mf-014, req-mf-015). Allowed object keys are `url`, `aliases`, `insecure`, and `x-*` vendor extensions; other keys MUST fail (mf-015). The boolean `insecure` MAY be set on a registry object (req-sc-006). For any registry URL using the `http://` scheme, parse MUST fail closed unless `insecure: true` is set on that object entry **or** the URL host is loopback (`127.0.0.0/8`, `localhost`), IPv6 loopback (`::1`), or an RFC1918 private address; string-form registry entries (URL only) have no `insecure` flag and therefore MUST satisfy the host exemption to use `http://`. Diagnostics for http-gate failures MUST name the registry. The key `registries.default` is a special-case name pointer: it MUST NOT be validated as a registry URL; when present it MUST be a non-empty string naming a declared registry entry.

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

#### Scenario: insecure true allows remote http registry

- **WHEN** a named registry object sets `url: http://example.com/...` and `insecure: true`
- **THEN** the system MUST accept the registries block

#### Scenario: remote http without insecure rejected with registry name

- **WHEN** a named registry object sets a non-exempt `http://` URL without `insecure: true`
- **THEN** the system MUST reject the manifest with a diagnostic that names that registry

#### Scenario: loopback http allowed without insecure

- **WHEN** a registry URL uses `http://127.0.0.1/...`, `http://localhost/...`, `http://[::1]/...`, or an RFC1918 host
- **THEN** the system MUST accept the entry without requiring `insecure: true`

#### Scenario: string-form remote http rejected

- **WHEN** a registry entry is a bare string `http://example.com/...` (no object, no insecure flag) and the host is not exempt
- **THEN** the system MUST reject the manifest naming that registry

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

If both `target` and `targets` are present, the system MUST reject the manifest at parse time, whether either field uses the legacy string/array form or the object-map form.

#### Scenario: Both target and targets rejected

- **WHEN** the document contains both `target` and `targets` (any accepted form of either)
- **THEN** the system MUST reject the manifest

### Requirement: Object-map target and targets accept host→package bindings

When `target` or `targets` is a YAML mapping (object), the system MUST treat it as a **bapm extension** host→integration-package map: each key MUST be a valid OpenAPM mf-005 target token (canonical host id, documented alias, or `x-<vendor>-<name>`); each value MUST be a non-empty string (npm package specifier, trimmed). Empty mappings MUST be rejected. Legacy forms remain valid: `target` as a non-empty string token, `targets` as a non-empty-string array. The system MUST reject non-string map values, non-string/non-mapping `target`, and `targets` that are neither a string array nor a string-valued mapping. Mutual exclusion of the two fields MUST still apply regardless of form. Successful parse MUST retain the object map on the in-memory document model. Dual-read `apm.yml` MUST use the same rules as `bapm.yml`.

#### Scenario: targets object map accepted

- **WHEN** a manifest declares `targets: { cursor: "@b-apm/integration-cursor", claude: "@b-apm/integration-claude" }` with valid mf-005 keys and non-empty string values
- **THEN** parse/validate MUST succeed and retain the mapping on the document

#### Scenario: target object map accepted

- **WHEN** a manifest declares `target: { claude: "@b-apm/integration-claude" }` with a valid key and non-empty string value
- **THEN** parse/validate MUST succeed and retain the mapping

#### Scenario: Legacy string and array still accepted

- **WHEN** a manifest declares `target: cursor` or `targets: [cursor, claude]`
- **THEN** parse/validate MUST succeed unchanged from prior behavior

#### Scenario: Invalid map key rejected

- **WHEN** an object-map `targets` (or `target`) uses a key that is not a valid mf-005 token
- **THEN** the system MUST reject with a diagnostic that names the bad token/path

#### Scenario: Empty or non-string map value rejected

- **WHEN** an object-map entry has an empty string value, or a non-string value
- **THEN** the system MUST reject the manifest

#### Scenario: Empty object map rejected

- **WHEN** `target` or `targets` is present as an empty mapping `{}`
- **THEN** the system MUST reject the manifest

### Requirement: M1 does not perform resolve lock or install

Successful parse/validate MUST NOT download dependencies, write lockfiles, or install packages.

#### Scenario: Local path deps remain unresolved

- **WHEN** a real project manifest with local `path:` dependencies is loaded successfully
- **THEN** the model MUST contain those dependency declarations and MUST NOT materialize or fetch them

### Requirement: Producer write validates before durable emit

Any producer path that serializes or writes a project manifest (init scaffold, rewrite, or pack preflight validate) MUST reject documents that fail OpenAPM Producer parse rules already covered by this capability (mf-001..003, registries mf-014/015 when present, mf-021 workspaces, mutual exclusion of `target`/`targets`). Successful durable writes MUST produce a top-level YAML mapping. Vendor `x-*` keys MUST be preserved on round-trip write when present; bapm MUST NOT invent normative required `x-bapm-*` keys as OpenAPM spec.

#### Scenario: Invalid emit rejected

- **WHEN** a producer write is attempted with a document missing non-empty `name` or string `version`
- **THEN** the write MUST fail closed and MUST NOT leave a successful conforming publish artifact for that attempt

#### Scenario: Vendor x-* preserved on write

- **WHEN** a valid document containing `x-acme-foo` is written via the producer write path
- **THEN** a subsequent load MUST retain `x-acme-foo` and MUST NOT require bapm-owned normative `x-bapm-*` keys

### Requirement: Target tokens validated on emit and validate

When `target` or `targets` is present on emit/validate, every host token MUST be a canonical host id, a documented alias, or a vendor id matching `x-<vendor>-<name>`. For legacy string / string-array forms, that means each string token. For object-map forms, that means each map key. Invalid tokens MUST be rejected with a diagnostic that names the bad token (OpenAPM mf-005). Object-map values MUST be validated as non-empty strings under the object-map requirement; they are not themselves mf-005 host tokens.

#### Scenario: Invalid target token rejected

- **WHEN** emit/validate runs with `targets: [not-a-host]` (or an invalid token)
- **THEN** the system MUST reject with non-zero failure and the diagnostic MUST name the invalid token

#### Scenario: Vendor target token accepted

- **WHEN** emit/validate runs with `target: x-acme-editor`
- **THEN** the token MUST be accepted as a vendor id

#### Scenario: Invalid object-map key rejected on emit

- **WHEN** emit/validate runs with an object-map `targets` whose key is not a valid mf-005 token
- **THEN** the system MUST reject with a diagnostic that names the invalid token

### Requirement: active field is a non-empty mf-005 token list

When top-level `active` is present on a project manifest, the system MUST accept only a YAML sequence of non-empty strings, each a valid OpenAPM mf-005 target token (canonical host id, documented alias, or `x-<vendor>-<name>`). Successful parse MUST retain `active` on the in-memory document. An empty sequence `active: []`, non-array shapes, empty string elements, or invalid tokens MUST be rejected with a diagnostic naming the path or bad token. Dual-read `apm.yml` MUST use the same rules as `bapm.yml`. Absence of `active` MUST remain valid.

#### Scenario: Non-empty active list accepted

- **WHEN** a manifest declares `active: [cursor, x-acme-editor]` with valid tokens
- **THEN** parse/validate MUST succeed and retain the list on the document

#### Scenario: Empty active list rejected

- **WHEN** a manifest declares `active: []`
- **THEN** the system MUST reject the manifest fail-closed

#### Scenario: Invalid active token rejected

- **WHEN** a manifest declares `active: [not-a-host]`
- **THEN** the system MUST reject with a diagnostic that names the invalid token

#### Scenario: Non-array active rejected

- **WHEN** a manifest declares `active: cursor` (scalar) or `active: { cursor: true }`
- **THEN** the system MUST reject the manifest

#### Scenario: Dual-read apm.yml accepts active

- **WHEN** only `apm.yml` is present and declares a valid non-empty `active` list
- **THEN** parse/validate MUST succeed under the same rules as `bapm.yml`

### Requirement: active validated on producer emit

When `active` is present on producer emit/validate, every element MUST satisfy mf-005 token rules. Invalid tokens or an empty list MUST fail closed before durable emit.

#### Scenario: Emit rejects empty active

- **WHEN** emit/validate runs with `active: []`
- **THEN** the write/validate MUST fail closed

### Requirement: Non-semver version warns on producer write

On producer write, when `version` is a non-empty string that is not semver-shaped, the system SHOULD emit a non-blocking warning (mf-004) and MUST NOT reject solely for that reason.

#### Scenario: Non-semver write warns but may succeed

- **WHEN** a producer write uses a non-semver string `version` that otherwise validates
- **THEN** the write MAY succeed and SHOULD attach or print a non-blocking semver warning

### Requirement: Registries aliases are typed hostname lists

On read, `registries.<name>.aliases` MUST be accepted only as an array of strings. Each string MUST be a hostname or a URL from which a hostname can be extracted. Non-array / non-string alias values MUST fail validation with a diagnostic naming the registry path. Parsed aliases MUST be retained on the in-memory registry entry so credential host-class union can bind alias hosts to the registry entry’s `url` host class. Empty arrays MUST be allowed. Absence of `aliases` MUST remain valid.

#### Scenario: String alias array accepted

- **WHEN** a registry object includes `aliases: ["mirror.example.net", "https://cdn.example.org/path"]`
- **THEN** parse MUST succeed and retain alias hostnames usable for credential class union

#### Scenario: Non-array aliases rejected

- **WHEN** a registry object sets `aliases` to a string or object instead of an array
- **THEN** validation MUST fail closed with a diagnostic naming `registries.<name>.aliases`

### Requirement: Manifest may declare top-level env for bake

The manifest YAML validator MUST accept an optional top-level `env` field as a string-to-string mapping with env-safe keys (`[A-Za-z_][A-Za-z0-9_]*`). Invalid shapes MUST fail validation. The field is a bapm extension used by MCP bake lookup; it MUST NOT be rejected solely as an unknown top-level key.

#### Scenario: env mapping round-trips on parse

- **WHEN** a valid manifest includes `env: { FOO: "bar" }`
- **THEN** the loaded document MUST expose `env.FOO` as `"bar"`

#### Scenario: Invalid env rejected

- **WHEN** `env` is a list, or a key is `1BAD`, or a value is a nested mapping
- **THEN** validation MUST fail closed

#### Scenario: Absence of env remains valid

- **WHEN** a valid manifest omits top-level `env`
- **THEN** parse/load MUST succeed
