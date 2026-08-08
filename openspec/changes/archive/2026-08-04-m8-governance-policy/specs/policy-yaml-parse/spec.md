## Purpose

Parses and validates OpenAPM-shaped policy YAML documents so bapm can load `*-policy.yml` with APM-compatible enums, tri-state lists, and unknown-key warnings before any install gate evaluation.

## ADDED Requirements

### Requirement: Minimal valid policy mapping parses

The system MUST accept a YAML mapping root with at least a string `name` and `enforcement` in `{off, warn, block}` (defaulting enforcement to `warn` when unset is allowed if documented). Non-mapping roots (list or scalar) MUST be rejected.

#### Scenario: Minimal valid warn policy

- **WHEN** a policy document `{name: org, enforcement: warn}` is parsed
- **THEN** parse MUST succeed and enforcement MUST be the string `warn`

#### Scenario: Non-mapping root rejected

- **WHEN** the policy document root is a YAML list or scalar
- **THEN** parse/validate MUST fail with a clear error

### Requirement: Enforcement enum coerce including YAML off bool

The system MUST coerce YAML boolean `off` used as `enforcement` to the string `"off"` (APM parity). Invalid enforcement values (for example `hard`) MUST be rejected.

#### Scenario: YAML bool off becomes string off

- **WHEN** policy YAML sets `enforcement: off` as a boolean
- **THEN** the model MUST store enforcement as the string `off`

#### Scenario: Invalid enforcement rejected

- **WHEN** policy YAML sets `enforcement: hard`
- **THEN** validate MUST fail

### Requirement: Unknown top-level keys warn; x-* preserved

Unknown top-level keys MUST produce warnings and MUST NOT cause a parse error (pl-009). Keys prefixed with `x-` MUST be accepted silently and preserved on the model.

#### Scenario: Unknown top-level warns

- **WHEN** policy contains `future_key: 1` alongside valid fields
- **THEN** parse MUST succeed and MUST emit at least one warning naming the unknown key

#### Scenario: Extension key preserved

- **WHEN** policy contains `x-acme-foo: bar`
- **THEN** parse MUST succeed without treating it as an unknown-key warning and the value MUST remain available on the model

### Requirement: Tri-state allow deny require lists

For `dependencies.allow`, `dependencies.deny`, and `dependencies.require` (and analogous list fields when present), omit and `null` MUST be transparent (unset), `[]` MUST be distinguishable as explicit empty, and a non-empty list MUST be retained (pl-005).

#### Scenario: Omit vs empty vs populated distinguishable

- **WHEN** three documents omit `allow`, set `allow: null`, set `allow: []`, and set `allow: [org/*]` respectively
- **THEN** the parsed models MUST distinguish unset/transparent from explicit empty from populated list

### Requirement: Dependencies and security fields accepted when present

The parser MUST accept `dependencies` fields used by M8 evaluation (`allow`, `deny`, `require`, `max_depth`, `require_pinned_constraint`) and top-level `enforcement` / `fetch_failure` (`off|warn|block`, default `fetch_failure` when unset = `warn`). Unsupported sections MAY be preserved or ignored with warnings but MUST NOT crash parse.

#### Scenario: Dependencies block loads

- **WHEN** policy includes `dependencies.deny: [org/legacy]` and `require_pinned_constraint: true`
- **THEN** parse MUST succeed and those fields MUST be available to evaluators
