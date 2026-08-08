## ADDED Requirements

### Requirement: Object-map target and targets accept host→package bindings

When `target` or `targets` is a YAML mapping (object), the system MUST treat it as a **bapm extension** host→integration-package map: each key MUST be a valid OpenAPM mf-005 target token (canonical host id, documented alias, or `x-<vendor>-<name>`); each value MUST be a non-empty string (npm package specifier, trimmed). Empty mappings MUST be rejected. Legacy forms remain valid: `target` as a non-empty string token, `targets` as a non-empty-string array. The system MUST reject non-string map values, non-string/non-mapping `target`, and `targets` that are neither a string array nor a string-valued mapping. Mutual exclusion of the two fields MUST still apply regardless of form. Successful parse MUST retain the object map on the in-memory document model. Dual-read `apm.yml` MUST use the same rules as `bapm.yml`.

#### Scenario: targets object map accepted

- **WHEN** a manifest declares `targets: { cursor: "@bapm/integration-cursor", claude: "@bapm/integration-claude" }` with valid mf-005 keys and non-empty string values
- **THEN** parse/validate MUST succeed and retain the mapping on the document

#### Scenario: target object map accepted

- **WHEN** a manifest declares `target: { claude: "@bapm/integration-claude" }` with a valid key and non-empty string value
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

## MODIFIED Requirements

### Requirement: Mutual exclusion of target and targets

If both `target` and `targets` are present, the system MUST reject the manifest at parse time, whether either field uses the legacy string/array form or the object-map form.

#### Scenario: Both target and targets rejected

- **WHEN** the document contains both `target` and `targets` (any accepted form of either)
- **THEN** the system MUST reject the manifest

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
