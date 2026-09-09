# deps-object-subset Specification

## Purpose

Lets consumers declare `skills:` and `targets:` on object-form APM dependencies (registry `- id:` as the APM 0.28 #2166 bar, git-longhand via the same grammar) so install materializes only that subset, and so registry identity round-trips as object-form YAML instead of collapsing to a git string.

## Requirements

### Requirement: Registry object-form deps accept skills and targets subsets

An object-form registry dependency (`id:` and optional companion `registry:`) MUST accept optional `skills:` and `targets:` using the same validated list grammar as git object-form (`git:`) entries. Successful parse MUST retain the lists on the in-memory entry. Omitted fields MUST mean no subset (install the full selectable skill set / all otherwise eligible targets). Present empty lists MUST fail closed at parse. String-form shorthands MUST NOT gain inline subset syntax in this change.

#### Scenario: Registry id entry with skills and targets accepted

- **WHEN** a manifest declares `- id: acme/toolkit` with `version` (and optional `registry:`) plus `skills: [deploy, lint]` and `targets: [cursor]`
- **THEN** parse MUST succeed and retain both lists on that dependency entry

#### Scenario: Git object-form uses the same subset grammar

- **WHEN** a manifest declares `- git: https://github.com/acme/toolkit.git` with the same `skills:` / `targets:` lists
- **THEN** parse MUST accept those lists with the same validation rules as the registry `id:` form

#### Scenario: Empty skills list rejected

- **WHEN** an object-form `id:` or `git:` entry sets `skills: []`
- **THEN** parse MUST fail closed with a diagnostic that the list must contain at least one skill name

#### Scenario: Empty targets list rejected

- **WHEN** an object-form `id:` or `git:` entry sets `targets: []`
- **THEN** parse MUST fail closed with a diagnostic that the list must contain at least one target name

### Requirement: Invalid subset values fail closed at parse

When `skills:` is present it MUST be a list of non-empty strings. Skill names MUST NOT contain path traversal (`..`) or absolute/drive prefixes. Duplicate names MUST be treated as a single name (deduped). When `targets:` is present it MUST be a list of non-empty strings, each a valid mf-005 host token under the current `isValidTargetToken` rules (canonical set, legacy aliases, vendor `x-<vendor>-<name>`). Unknown or malformed tokens MUST fail closed naming the bad value. Non-list / non-string shapes MUST fail closed.

#### Scenario: Skill path traversal rejected

- **WHEN** an object-form registry or git entry sets `skills: ["../evil"]`
- **THEN** parse MUST fail closed with a diagnostic mentioning traversal or an unsafe skill name

#### Scenario: Unknown subset target rejected

- **WHEN** an object-form registry or git entry sets `targets: [not-a-target]`
- **THEN** parse MUST fail closed naming the unknown target token

#### Scenario: Non-list skills rejected

- **WHEN** an object-form entry sets `skills: deploy` (a scalar) or a mapping
- **THEN** parse MUST fail closed

### Requirement: Install materializes only the declared subset

When a resolved dependency originated from an object-form entry with a non-empty `skills:` subset, install MUST deploy only skill primitives whose names (or documented plugin skill-path aliases) are in that subset. Other primitive types from that package MUST still follow existing intersection / exclude / only-mode rules and MUST NOT be dropped solely because `skills:` is set. When a non-empty per-dep `targets:` subset is present, that dependency's target-scoped primitives MUST deploy only onto the intersection of the active install target set with that subset (and with existing package-declared / consumer-authorized intersection). Omitted `skills:` / `targets:` MUST NOT narrow. Full package fetch/download MUST still occur; subset is materialize-time only.

#### Scenario: Skills subset omits other skills

- **WHEN** a registry or git object-form dependency lists `skills: [keep-me]` and the package exposes skill primitives `keep-me` and `drop-me`
- **THEN** install MUST materialize `keep-me` and MUST NOT materialize `drop-me` for that dependency

#### Scenario: Per-dep targets subset skips non-overlapping active host

- **WHEN** install's active target is `cursor` and a dependency entry declares `targets: [copilot]`
- **THEN** that dependency's target-scoped primitives MUST NOT be deployed to cursor

#### Scenario: Omitted skills deploys all selectable skills

- **WHEN** an object-form `id:` dependency has no `skills:` field and the package exposes multiple skills
- **THEN** install MUST materialize those skills subject only to existing non-subset filters

### Requirement: Empty skill-subset match is diagnosed (req-mf-022)

When a non-empty persisted `skills:` subset is applied to a dependency that exposes selectable skills and zero skills from that dependency are deployed because no selected name matches an available skill, install MUST emit a default-visible diagnostic identifying the dependency, the requested names, and the available names (or that none are available). The overall install MAY still succeed when no other error exists; this MUST NOT silently complete with zero matches and no diagnostic.

#### Scenario: Stale skill pin warns

- **WHEN** a dependency declares `skills: [gone]` and the package's available skills are `[alpha, beta]`
- **THEN** install MUST emit a diagnostic naming the dependency, `gone`, and the available names, and MUST NOT treat silence as success for that mismatch

### Requirement: Registry object-form identity is preserved on serialize and rewrite (req-mf-024)

Serializing or rewriting a registry-sourced (`id:` / `registry:`) dependency MUST emit object-form YAML with `id` (and `registry` / `version` / `path` / `alias` when those were present), including `skills` / `targets` when set. The implementation MUST NOT collapse that entry to a git string or to a `git:` mapping. When a later structured update (including a future CLI skill pin) would replace an existing registry-sourced entry with a non-registry-shaped entry for the same identity, the update MUST be rejected with a diagnostic naming the identity, leaving the original entry unchanged. A registry-shaped replacement that only adds or updates `skills:` / `targets:` MUST be allowed.

#### Scenario: Registry entry with skills round-trips as id object

- **WHEN** a parsed `- id: acme/toolkit` entry with `version` and `skills: [alpha]` is serialized then parsed again
- **THEN** the round-trip document MUST still have object-form `id: acme/toolkit` with `skills` containing `alpha`, and MUST NOT contain `git:` for that entry

#### Scenario: Registry entry without skills still serializes as object

- **WHEN** a parsed `- id: acme/toolkit` with `registry` and `version` (no `skills:`) is serialized
- **THEN** the emitted YAML MUST remain a mapping with `id` (and `registry` / `version`), not a canonical git string

#### Scenario: Silent registry-to-git rewrite refused

- **WHEN** an existing manifest entry is `{ id: acme/demo-pkg, version: 1.0.0 }` and a structured merge attempts `{ git: acme/demo-pkg, ref: 1.0.0, skills: [some-skill] }` for the same identity
- **THEN** the merge MUST fail closed naming the identity, and the original `id:` entry MUST remain unchanged
