# manifest-active-targets Specification

## Purpose

Defines how the project manifest field `active` selects which registered host integrations to activate for materialize/MCP (multi) and compile (single), without conflating that choice with `target` / `targets` preference or package maps.

## Requirements

### Requirement: Manifest active lists hosts to materialize

When the project manifest declares top-level structured `active` that resolves to a non-empty ordered set of **target** ids (after applying include/negate rules and nested preset `active` expansion per `manifest-presets`, and after object-map registration for the run), install MUST treat that target-id set as the hosts to activate for materialization and eligible MCP configuration, unless a forced CLI `--target` / forced-target option is supplied. Forced target MUST override resolved target ids from `active` for that run and MUST activate only the forced id. `active` that selects only presets (no target ids after resolution) MUST be treated as absent for host selection and MUST preserve detect-then-fail when no force is set. Omitting `active` MUST likewise preserve detect-then-fail. Dual-read `apm.yml` MUST honor the same field. `active` MUST NOT rely on eagerly built-in host registrations from the CLI. Preset names MUST NOT be passed to the integration registry as host ids.

#### Scenario: Sole active materializes without --target or detect

- **WHEN** the manifest declares `active: { target: cursor }`, cursor is registered via object-map, install runs without `--target`, and detect would not select a host
- **THEN** install MUST activate `cursor` and MUST invoke its materialize subject to existing install gates

#### Scenario: Multi active materializes each registered host

- **WHEN** the manifest declares `active: { target: [cursor, x-acme-editor] }`, both ids are registered after map load, and install runs without `--target`
- **THEN** install MUST materialize each listed id (subject to intersection/exclude/only-mode) and MUST NOT require filesystem detect

#### Scenario: --target overrides active

- **WHEN** the manifest declares `active: { target: [cursor, x-acme-editor] }` and the user runs install with `--target cursor`
- **THEN** install MUST activate only `cursor` and MUST NOT materialize `x-acme-editor` for that run

#### Scenario: Absent active keeps detect path

- **WHEN** the manifest omits `active` and install runs without `--target`
- **THEN** selection MUST follow sole-detect or fail-closed guidance as in `install-pipeline` (not invent activation from `target`/`targets` alone)

#### Scenario: Preset-only active keeps detect path for hosts

- **WHEN** the manifest declares `active: { preset: developer }` with no resolved target ids and install runs without `--target`
- **THEN** host selection MUST follow sole-detect or fail-closed guidance as in `install-pipeline` (not invent activation from presets)

### Requirement: Unknown or unregistered active ids fail closed

After successful object-map loading attempts (when present) and with no eager built-in host registrations, every **target** id in the resolved `active` target set MUST resolve to a registered integration before any host harness writes for that install. If any target id is missing from the registry, the command MUST fail closed with a diagnostic naming the id and MUST NOT partially materialize the remaining listed hosts. Preset name resolution failures MUST fail per `manifest-presets` before or without host materialize.

#### Scenario: Active id missing after map load

- **WHEN** the manifest declares `active: { target: x-missing }` and map load does not provide `x-missing`
- **THEN** install MUST exit non-zero naming `x-missing` and MUST NOT write harness files for that id

#### Scenario: One unknown among several aborts all

- **WHEN** resolved `active` targets list a registered id and an unregistered id together
- **THEN** install MUST fail closed before materializing either listed host

### Requirement: Active does not replace target or targets roles

The field `active` MUST NOT be treated as a substitute for `target` / `targets` declared preference, intersection keys, or object-map package bindings. Declared project target ids for intersection MUST continue to come only from `target` / `targets`. Object-map load MUST continue to follow `target-integration-dynamic-load`. Authors MAY set structured `active` together with `target` / `targets`. Selecting a preset MUST NOT imply a host map entry.

#### Scenario: Active with object-map still loads packages from map

- **WHEN** the manifest has object-map `targets` binding `x-acme-editor` to a resolvable runtime package and `active: { target: x-acme-editor }`
- **THEN** the composition root MUST load/register the map package before activation and install MUST be allowed to materialize `x-acme-editor` without `--target`

#### Scenario: Intersection still uses target or targets only

- **WHEN** the project declares `targets: [cursor]` (legacy or map keys) and `active: { target: cursor }`
- **THEN** package primitive intersection MUST still use declared ids from `target`/`targets`, not invent a second declared set from `active` alone

### Requirement: Compile uses sole active or requires --target

Compile MUST remain single-host. When no `--target` is supplied and the resolved `active` **target** set contains exactly one registered compile-capable id, compile MUST select that id. When the resolved target set contains more than one id and no `--target` is supplied, compile MUST fail closed with guidance to pass `--target <id>` and MUST NOT write compile output. Forced `--target` MUST override `active`. Preset-only `active` (no resolved targets) MUST follow the same missing/ambiguous detect path as absent `active`.

#### Scenario: Sole active selects compile host

- **WHEN** `active: { target: cursor }`, cursor is registered and compile-capable, and compile runs without `--target`
- **THEN** compile MUST use cursor’s compile capability

#### Scenario: Multi active without --target fails compile

- **WHEN** resolved `active` targets list two or more ids and `bapm compile` runs without `--target`
- **THEN** compile MUST exit non-zero with guidance to pass `--target <id>` and MUST NOT write compile output

### Requirement: Effective active uses merged local overlay

When resolving host activation and preset inclusion, the system MUST use the **effective** structured `active` after applying `bapm.local.yml` over the base dual-read manifest (per `manifest-local-overlay`). Forced CLI `--target` / forced-target MUST still override effective resolved **target** ids. Object-map integration packages MUST load from the effective `target` / `targets` maps after the same merge. Omitting `active` from both base and local MUST preserve detect-then-fail selection when no force is set. Local overlay MUST NOT define `presets`; preset definitions come from the base manifest only.

#### Scenario: Local active used when base omits active

- **WHEN** base omits `active`, `bapm.local.yml` declares `active: { target: cursor }`, cursor is registered, and install runs without `--target`
- **THEN** install MUST activate `cursor` without requiring filesystem detect

#### Scenario: Local object-map loads before activation

- **WHEN** `bapm.local.yml` provides an object-map `targets` binding `x-acme-editor` and `active: { target: x-acme-editor }`, and the package is resolvable
- **THEN** the composition root MUST load/register that map package before activation using the effective map

#### Scenario: Local preset selection uses base preset definitions

- **WHEN** base defines preset `developer` and omits `active`, and `bapm.local.yml` declares `active: { preset: developer }`
- **THEN** install/lock MUST include that preset’s dependencies in the effective graph and MUST NOT require `presets` on the overlay
