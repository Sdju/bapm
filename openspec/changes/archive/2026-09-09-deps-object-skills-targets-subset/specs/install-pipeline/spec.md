## ADDED Requirements

### Requirement: Per-dependency skills subset filters materialized skills

When install materializes primitives for a dependency whose declaring object-form entry has a non-empty `skills:` subset, it MUST deploy only skill primitives from that dependency whose names (or documented plugin skill-path aliases such as `skills/productivity/grill-me`) are in the subset. Skill primitives outside the subset MUST NOT be written to harness roots. Non-skill primitives from that dependency MUST NOT be dropped solely due to `skills:`. Existing exclude, only-mode, dry-run, and package-declared target intersection MUST still apply.

#### Scenario: Named skills only

- **WHEN** install runs against a package that exposes skills `alpha` and `beta` and the consumer entry is `- id: acme/toolkit` with `skills: [alpha]`
- **THEN** `alpha` MUST be materialized and `beta` MUST NOT

#### Scenario: Git-longhand same filter

- **WHEN** install runs against the same package declared as `- git: …` with `skills: [alpha]`
- **THEN** materialize MUST match the registry `id:` subset outcome for those skills

### Requirement: Per-dependency targets subset intersects active hosts

When a dependency entry declares a non-empty consumer-side `targets:` list, that dependency's target-scoped primitives MUST deploy only when the active install target is in that list, composed with existing package-declared and consumer-authorized intersection (effective reach is active ∩ package-declared ∩ per-dep `targets:`). This field is distinct from the package's own top-level `target`/`targets` in its manifest. An omitted per-dep `targets:` MUST NOT add this extra conjunct.

#### Scenario: Per-dep targets skip active cursor

- **WHEN** the active install target is `cursor` and the consumer entry declares `targets: [copilot]` on that dependency
- **THEN** that dependency's target-scoped primitives MUST NOT be deployed to cursor

#### Scenario: Matching per-dep target still deploys

- **WHEN** the active install target is `cursor` and the consumer entry declares `targets: [cursor]`
- **THEN** that dependency's primitives MAY deploy to cursor subject to package-declared intersection and other existing filters

### Requirement: Structured rewrite must not convert registry id to git

When install or a package-ref merge updates an existing `dependencies.apm` entry whose source is registry (`id:` / `registry:`), the persisted entry MUST remain registry object-form. A structured replacement that is git-shaped (`git:` key or canonical git string) for the same identity MUST be rejected with a diagnostic naming the identity, without mutating the original entry (req-mf-024). A registry-shaped update that adds `skills:` / `targets:` MUST be persisted as object-form.

#### Scenario: Adding skills keeps id form

- **WHEN** the manifest already has `- id: acme/demo-pkg` with `version: 1.0.0` and a structured update adds `skills: [alpha]`
- **THEN** the written entry MUST still be a mapping with `id: acme/demo-pkg` and MUST NOT contain `git:`

#### Scenario: Git-shaped replacement of registry identity refused

- **WHEN** a merge would replace `{ id: acme/demo-pkg, version: 1.0.0 }` with `{ git: acme/demo-pkg, skills: [alpha] }`
- **THEN** the operation MUST fail closed naming `acme/demo-pkg` and the original mapping MUST remain
