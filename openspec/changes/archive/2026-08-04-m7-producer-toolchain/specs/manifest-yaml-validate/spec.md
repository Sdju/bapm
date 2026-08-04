## ADDED Requirements

### Requirement: Producer write validates before durable emit
Any producer path that serializes or writes a project manifest (init scaffold, rewrite, or pack preflight validate) MUST reject documents that fail OpenAPM Producer parse rules already covered by this capability (mf-001..003, registries mf-014/015 when present, mf-021 workspaces, mutual exclusion of `target`/`targets`). Successful durable writes MUST produce a top-level YAML mapping. Vendor `x-*` keys MUST be preserved on round-trip write when present; bapm MUST NOT invent normative required `x-bapm-*` keys as OpenAPM spec.

#### Scenario: Invalid emit rejected
- **WHEN** a producer write is attempted with a document missing non-empty `name` or string `version`
- **THEN** the write MUST fail closed and MUST NOT leave a successful conforming publish artifact for that attempt

#### Scenario: Vendor x-* preserved on write
- **WHEN** a valid document containing `x-acme-foo` is written via the producer write path
- **THEN** a subsequent load MUST retain `x-acme-foo` and MUST NOT require bapm-owned normative `x-bapm-*` keys

### Requirement: Target tokens validated on emit and validate
When `target` or `targets` is present on emit/validate, each token MUST be a canonical host id, a documented alias, or a vendor id matching `x-<vendor>-<name>`. Invalid tokens MUST be rejected with a diagnostic that names the bad token (OpenAPM mf-005).

#### Scenario: Invalid target token rejected
- **WHEN** emit/validate runs with `targets: [not-a-host]` (or an invalid token)
- **THEN** the system MUST reject with non-zero failure and the diagnostic MUST name the invalid token

#### Scenario: Vendor target token accepted
- **WHEN** emit/validate runs with `target: x-acme-editor`
- **THEN** the token MUST be accepted as a vendor id

### Requirement: Non-semver version warns on producer write
On producer write, when `version` is a non-empty string that is not semver-shaped, the system SHOULD emit a non-blocking warning (mf-004) and MUST NOT reject solely for that reason.

#### Scenario: Non-semver write warns but may succeed
- **WHEN** a producer write uses a non-semver string `version` that otherwise validates
- **THEN** the write MAY succeed and SHOULD attach or print a non-blocking semver warning
