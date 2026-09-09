## MODIFIED Requirements

### Requirement: Local overlay allowlist and validation

`bapm.local.yml` MUST be a YAML mapping. Allowed top-level keys in v1 are exactly: `active`, `target`, `targets`, `env`, and `registries`. The overlay MUST NOT require `name` or `version`. Any other top-level key (including `name`, `version`, `dependencies`, `devDependencies`, `presets`, and `x-*`) MUST fail validation. Field shapes for allowed keys MUST match the corresponding base-manifest validation rules for those fields (including structured `active` per `manifest-presets` / `manifest-yaml-validate`, mf-005 host tokens, and object-map package strings where applicable).

#### Scenario: Allowlisted overlay accepted

- **WHEN** `bapm.local.yml` contains only structured `active: { target: cursor }` and optional valid `targets` / `env` / `registries` maps
- **THEN** validation MUST accept the overlay

#### Scenario: Structured preset active on overlay accepted

- **WHEN** `bapm.local.yml` contains `active: { preset: developer }` (or list-of-maps / negation forms) and the base manifest defines that preset
- **THEN** overlay validation MUST accept the `active` shape (unknown preset names fail at resolve time per `manifest-presets`)

#### Scenario: Forbidden key rejected

- **WHEN** `bapm.local.yml` includes `dependencies` or `name` or `presets` or an unknown key
- **THEN** load MUST fail closed with a diagnostic identifying the disallowed key

### Requirement: Merge precedence flags then local then base then env

Effective settings MUST apply layers in this order of increasing precedence (higher wins on conflict): process-env overrides for a setting (only when that setting has an env override) < base dual-read manifest < `bapm.local.yml` < direct CLI flags. Equivalently, consumers MUST resolve as: **CLI flags → `bapm.local.yml` → base `bapm.yml`/`apm.yml` → env overrides**. Forced `--target` MUST override effective resolved target ids from local or base `active` for that run.

#### Scenario: Local active overrides base active

- **WHEN** base has `active: { target: cursor }` and `bapm.local.yml` has `active: { target: x-acme-editor }`, and install runs without `--target`
- **THEN** effective activation MUST use `[x-acme-editor]` (subject to registration gates)

#### Scenario: CLI --target overrides local active

- **WHEN** `bapm.local.yml` has `active: { target: x-acme-editor }` and the user passes `--target cursor`
- **THEN** the run MUST activate only `cursor`

### Requirement: Per-field merge rules for overlay

When merging local over base, the system MUST apply: `active` → replace the entire structured `active` value when local sets `active`; `env` → deep-merge string keys with local winning per key; `registries` → deep-merge by registry name with local entry overlaying/replacing that name; `target`/`targets` → when both sides are object-maps for the same field, deep-merge host keys with local winning per key; otherwise when local sets the field, replace that field with the local value and restore mutual exclusion of `target` vs `targets` on the effective document. After merge, the effective document MUST pass the same validate rules as a base manifest for the merged fields. `presets` MUST remain base-only and MUST NOT be introduced by overlay merge.

#### Scenario: Active list replace not append

- **WHEN** base has `active: { target: cursor }` and local has `active: { preset: developer, target: x-acme-editor }`
- **THEN** effective `active` MUST be exactly the local structured value (not a merged union of target lists)

#### Scenario: Target object-map keys deep-merge

- **WHEN** base `targets` maps `cursor` to package A and local `targets` maps `x-acme-editor` to package B
- **THEN** effective `targets` MUST contain both keys with those package values

#### Scenario: Env keys deep-merge with local win

- **WHEN** base `env` has `FOO: "base"` and `BAR: "keep"`, and local `env` has `FOO: "local"`
- **THEN** effective `env.FOO` MUST be `"local"` and `env.BAR` MUST remain `"keep"`
