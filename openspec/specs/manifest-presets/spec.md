# manifest-presets Specification

## Purpose

Defines named dependency presets on the project manifest, how structured `active` includes or negates them, expansion into the effective dependency set, optional nested `active` on a preset, and fail-closed detection of recursive preset→active chains.

## Requirements

### Requirement: Presets declare named dependency bundles

When top-level `presets` is present on the project base manifest, the system MUST accept a non-empty YAML sequence of mappings. Each entry MUST declare a non-empty string `name` unique among presets in that document. An entry MAY declare `dependencies` and/or `devDependencies` using the same mapping shapes allowed at the manifest root for those fields. An entry MAY declare nested `active` using the same structured `active` grammar as the top-level field. Absence of `presets` MUST remain valid. Duplicate `name` values, missing `name`, empty `presets: []`, or non-sequence `presets` MUST fail validation.

#### Scenario: Named presets with dependencies accepted

- **WHEN** the manifest declares `presets` with entries `analyst` and `developer`, each with a valid `dependencies` mapping
- **THEN** parse/validate MUST succeed and retain both presets on the in-memory document

#### Scenario: Duplicate preset name rejected

- **WHEN** two preset entries share the same `name`
- **THEN** validation MUST fail closed naming the duplicate `name`

### Requirement: Structured active selects presets and targets

Top-level and nested `active` MUST select zero or more **presets** and zero or more **targets** using either:

1. a non-empty YAML sequence of single-key mappings, each key being `preset` or `target` with a string value (optionally prefixed by `!` for negation); or
2. a YAML mapping with optional keys `preset` and/or `target`, each a non-empty string or a non-empty sequence of such strings (each optionally `!`-prefixed).

At least one of preset or target selection MUST be present in a non-empty `active` value. Bare sequences of host-token strings (legacy `active: [cursor]`) MUST be rejected. Scalar `active` MUST be rejected. Preset name tokens (without leading `!`) MUST match an existing preset `name` when resolving inclusion; target tokens (without leading `!`) MUST be valid mf-005 host tokens at parse time. Leading `!` MUST mark negation of that preset or target id (the remainder after `!` is the id).

#### Scenario: List-of-maps active accepted

- **WHEN** `active` is a sequence containing `{ preset: developer }` and `{ target: cursor }`
- **THEN** validation MUST accept and retain both selections

#### Scenario: Object-form active with arrays accepted

- **WHEN** `active` is `{ preset: [developer, analyst], target: cursor }`
- **THEN** validation MUST accept both preset names and the target token

#### Scenario: Negation entries accepted at parse

- **WHEN** `active` includes `{ preset: !developer }` and `{ target: !cursor }`
- **THEN** validation MUST accept the negated ids (resolution applies negation later)

#### Scenario: Legacy bare host list rejected

- **WHEN** `active` is `[cursor]` (sequence of bare strings)
- **THEN** validation MUST fail closed and MUST NOT treat the values as target ids

### Requirement: Effective included presets apply negation

When computing the included preset set from effective `active` (after overlay merge), the system MUST start from an empty included set, apply non-negated `preset` selections as includes (and follow nested `active` on those presets per the nested-active requirement), then apply negated `preset` selections as excludes. A preset that is both included and later negated MUST NOT remain in the included set. Unknown preset names on include MUST fail closed. Unknown names on negate-only MAY fail closed with a diagnostic naming the id (implementations MUST NOT silently ignore unknown includes).

#### Scenario: Include then negate drops preset

- **WHEN** effective `active` includes `developer` and also negates `!developer` (order as declared in the document forms)
- **THEN** the included preset set MUST NOT contain `developer`

#### Scenario: Unknown included preset fails

- **WHEN** `active` references `preset: missing-role` and no preset with that name exists
- **THEN** resolve/install MUST fail closed naming `missing-role` before writing lock or modules for that graph

### Requirement: Nested preset active expands with cycle detection

When an included preset declares nested `active`, the system MUST expand further preset and target selections from that nested field using the same include/negate rules, merging into the overall selection. If expansion revisits a preset already on the current resolution stack (a cycle in preset→active→preset chains), the system MUST fail closed with a diagnostic describing the cycle and MUST NOT install a partial graph. Deep but acyclic chains MUST be allowed.

#### Scenario: Acyclic nested preset expands

- **WHEN** preset `team` nests `active` that includes preset `developer`, and top-level `active` includes `team`
- **THEN** both `team` and `developer` MUST be in the included preset set (subject to later negation)

#### Scenario: Recursive preset active fails closed

- **WHEN** preset `a` nests `active` including preset `b`, and preset `b` nests `active` including preset `a`, and top-level `active` includes `a`
- **THEN** the command MUST exit non-zero citing a preset active cycle and MUST NOT write modules/lock for that expansion

### Requirement: Effective dependency graph unions base and included presets

For resolve, lock, and install planning, the system MUST treat the effective direct dependency declarations as the union of the base manifest `dependencies` / `devDependencies` (when present) with the corresponding dependency maps from every included preset. Base entries MUST always apply when present even if no preset is included. Host activation MUST NOT add packages merely because a target id is selected. Dependency source form `local` / `local:` and host `target`/`targets` integration maps MUST remain separate concerns.

#### Scenario: Base plus one preset unions packages

- **WHEN** base declares package `shared-skill` and included preset `developer` declares `dev-skill`, and install/lock runs
- **THEN** the resolved direct set MUST include both packages

#### Scenario: No presets keeps base-only graph

- **WHEN** the manifest omits `active` or effective `active` includes no presets
- **THEN** resolve MUST use only base dependency maps (unchanged vs presets-absent behavior)

#### Scenario: Same package conflicting constraints fail closed

- **WHEN** base and an included preset both declare the same direct package name with incompatible constraint/source shapes
- **THEN** resolve MUST fail closed naming the package and MUST NOT pick an arbitrary winner
