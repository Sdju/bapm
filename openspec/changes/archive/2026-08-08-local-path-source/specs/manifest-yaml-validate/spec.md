## ADDED Requirements

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

## MODIFIED Requirements

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
