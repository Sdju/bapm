# manifest-local-overlay Specification

## Purpose

Optional personal overlay file `bapm.local.yml` at the project manifest root: allowlisted fields, merge into effective settings with fixed precedence, and keep the file out of publish surfaces.

## Requirements

### Requirement: Optional bapm.local.yml discovered beside project root

When loading effective project settings and no explicit override disables local overlay, the system MUST look for `bapm.local.yml` in the same project root used for dual-read base discovery (process cwd or explicit root; no parent walk-up). Absence of `bapm.local.yml` MUST be success and MUST leave effective settings equal to the validated base manifest alone. The filename MUST be exactly `bapm.local.yml` (not a typo brand such as `bamp.local.yml`). This file MUST NOT be confused with dependency source discriminator `local` / `local:`.

#### Scenario: Missing local overlay is fine

- **WHEN** the project root has a valid base `bapm.yml` or `apm.yml` and no `bapm.local.yml`
- **THEN** load MUST succeed using only the base manifest

#### Scenario: Local overlay loads from project root

- **WHEN** the project root contains a valid base manifest and a valid `bapm.local.yml`
- **THEN** the system MUST load both and produce an effective merged document for downstream commands

#### Scenario: Local overlay not found via parent walk-up

- **WHEN** cwd has a base manifest but `bapm.local.yml` exists only in a parent directory
- **THEN** the system MUST NOT load that parent overlay

### Requirement: apm.local.yml is refused in v1

The system MUST treat `apm.local.yml` as unsupported in v1. When `apm.local.yml` is present in the project root, load MUST fail closed with a diagnostic naming the unsupported file and MUST NOT merge either local brand file. Presence of only `bapm.local.yml` MUST remain allowed.

#### Scenario: apm.local.yml alone fails

- **WHEN** the project root contains `apm.local.yml` (with or without `bapm.local.yml`)
- **THEN** effective load MUST exit non-zero naming `apm.local.yml` and MUST NOT apply a local overlay

### Requirement: Local overlay allowlist and validation

`bapm.local.yml` MUST be a YAML mapping. Allowed top-level keys in v1 are exactly: `active`, `target`, `targets`, `env`, and `registries`. The overlay MUST NOT require `name` or `version`. Any other top-level key (including `name`, `version`, `dependencies`, `devDependencies`, and `x-*`) MUST fail validation. Field shapes for allowed keys MUST match the corresponding base-manifest validation rules for those fields (including mf-005 host tokens and object-map package strings where applicable).

#### Scenario: Allowlisted overlay accepted

- **WHEN** `bapm.local.yml` contains only `active: [cursor]` and optional valid `targets` / `env` / `registries` maps
- **THEN** validation MUST accept the overlay

#### Scenario: Forbidden key rejected

- **WHEN** `bapm.local.yml` includes `dependencies` or `name` or an unknown key
- **THEN** load MUST fail closed with a diagnostic identifying the disallowed key

### Requirement: Merge precedence flags then local then base then env

Effective settings MUST apply layers in this order of increasing precedence (higher wins on conflict): process-env overrides for a setting (only when that setting has an env override) < base dual-read manifest < `bapm.local.yml` < direct CLI flags. Equivalently, consumers MUST resolve as: **CLI flags → `bapm.local.yml` → base `bapm.yml`/`apm.yml` → env overrides**. Forced `--target` MUST override effective `active` from local or base for that run.

#### Scenario: Local active overrides base active

- **WHEN** base has `active: [cursor]` and `bapm.local.yml` has `active: [x-acme-editor]`, and install runs without `--target`
- **THEN** effective activation MUST use `[x-acme-editor]` (subject to registration gates)

#### Scenario: CLI --target overrides local active

- **WHEN** `bapm.local.yml` has `active: [x-acme-editor]` and the user passes `--target cursor`
- **THEN** the run MUST activate only `cursor`

### Requirement: Per-field merge rules for overlay

When merging local over base, the system MUST apply: `active` → replace the entire list when local sets `active`; `env` → deep-merge string keys with local winning per key; `registries` → deep-merge by registry name with local entry overlaying/replacing that name; `target`/`targets` → when both sides are object-maps for the same field, deep-merge host keys with local winning per key; otherwise when local sets the field, replace that field with the local value and restore mutual exclusion of `target` vs `targets` on the effective document. After merge, the effective document MUST pass the same validate rules as a base manifest for the merged fields.

#### Scenario: Active list replace not append

- **WHEN** base has `active: [cursor]` and local has `active: [x-acme-editor]`
- **THEN** effective `active` MUST be exactly `[x-acme-editor]`

#### Scenario: Target object-map keys deep-merge

- **WHEN** base `targets` maps `cursor` to package A and local `targets` maps `x-acme-editor` to package B
- **THEN** effective `targets` MUST contain both keys with those package values

#### Scenario: Env keys deep-merge with local win

- **WHEN** base `env` has `FOO: "base"` and `BAR: "keep"`, and local `env` has `FOO: "local"`
- **THEN** effective `env.FOO` MUST be `"local"` and `env.BAR` MUST remain `"keep"`

### Requirement: Local overlay stays unpublished

The system MUST treat `bapm.local.yml` as non-publishable personal config: default pack collection MUST omit the file; publish archive construction MUST omit the file; project guidance MUST include ignoring `bapm.local.yml` via gitignore (document and/or ensure-append). Pack MUST NOT fail solely because an untracked `bapm.local.yml` exists beside the project.

#### Scenario: Pack omits bapm.local.yml

- **WHEN** pack collects files for a project that contains `bapm.local.yml` next to a conforming base manifest
- **THEN** the pack artifact MUST NOT include `bapm.local.yml`

#### Scenario: Publish omits bapm.local.yml

- **WHEN** publish builds a registry or upload zip from a project that contains `bapm.local.yml`
- **THEN** the published archive MUST NOT include `bapm.local.yml`
