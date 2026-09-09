## REMOVED Requirements

### Requirement: active field is a non-empty mf-005 token list

**Reason**: `active` is redefined as structured preset/target selection (list-of-maps or object forms with optional `!` negation). Legacy bare host-token sequences are no longer valid; nothing in production depended on the old shape.

**Migration**: Rewrite `active: [cursor]` to `active: { target: cursor }` or `active: [{ target: cursor }]`. Include presets via `preset:` entries. No automated dual-read of the legacy list form.

### Requirement: active validated on producer emit

**Reason**: Producer emit must validate the structured `active` grammar instead of mf-005-only string lists.

**Migration**: Emit/validate callers supply structured `active`; see ADDED structured emit requirement.

## ADDED Requirements

### Requirement: active field is structured preset and target selection

When top-level `active` is present on a project manifest, the system MUST accept only the structured forms defined by `manifest-presets`: a non-empty sequence of single-key `{ preset: … }` / `{ target: … }` mappings, or a non-empty mapping with `preset` and/or `target` keys whose values are a non-empty string or non-empty string sequence. Each preset/target string MAY begin with `!` for negation; the id after an optional `!` for `target` MUST be a valid OpenAPM mf-005 host token; the id for `preset` MUST be a non-empty name token. Successful parse MUST retain structured `active` on the in-memory document. Empty `active: []`, empty `active: {}`, legacy bare string sequences such as `active: [cursor]`, scalars, multi-key map entries in the list form, empty string elements, or invalid target tokens MUST be rejected with a diagnostic naming the path or bad token. Dual-read `apm.yml` MUST use the same rules as `bapm.yml`. Absence of `active` MUST remain valid.

#### Scenario: List-of-maps active accepted

- **WHEN** a manifest declares `active` as `[{ preset: developer }, { target: cursor }]` with a defined preset `developer`
- **THEN** parse/validate MUST succeed and retain structured `active`

#### Scenario: Object-form active accepted

- **WHEN** a manifest declares `active: { preset: developer, target: [cursor] }`
- **THEN** parse/validate MUST succeed

#### Scenario: Empty active rejected

- **WHEN** a manifest declares `active: []` or `active: {}`
- **THEN** validation MUST fail closed

#### Scenario: Legacy bare host list rejected

- **WHEN** a manifest declares `active: [cursor]`
- **THEN** validation MUST fail closed

#### Scenario: Invalid target token rejected

- **WHEN** a manifest declares `active: { target: not-a-host }`
- **THEN** validation MUST fail closed naming the bad token

#### Scenario: Dual-read apm.yml accepts structured active

- **WHEN** only `apm.yml` is present and declares a valid structured `active` with `target: cursor`
- **THEN** parse/validate MUST succeed

### Requirement: presets field validates named entries

When top-level `presets` is present, validation MUST enforce the shapes required by `manifest-presets` (non-empty sequence, unique `name`, optional dependency maps and nested `active`). Nested `active` MUST use the same structured grammar as top-level `active`. Invalid nested shapes MUST fail with a path under the offending preset.

#### Scenario: Preset nested active validated

- **WHEN** a preset declares nested `active: { target: cursor }` with a valid token
- **THEN** validation MUST accept the nested field

#### Scenario: Preset nested legacy active rejected

- **WHEN** a preset declares nested `active: [cursor]`
- **THEN** validation MUST fail closed at that nested path

### Requirement: active validated on producer emit uses structured form

When `active` is present on producer emit/validate, it MUST satisfy the structured preset/target grammar. Legacy bare host-token lists, empty structures, or invalid tokens MUST fail closed before durable emit.

#### Scenario: Emit rejects legacy bare active list

- **WHEN** emit/validate runs with `active: [cursor]`
- **THEN** emit MUST fail closed before writing

#### Scenario: Emit accepts structured target active

- **WHEN** emit/validate runs with `active: { target: cursor }`
- **THEN** emit MUST accept the field when other emit rules pass
