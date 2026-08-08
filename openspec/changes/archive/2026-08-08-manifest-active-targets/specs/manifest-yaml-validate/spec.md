## ADDED Requirements

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
