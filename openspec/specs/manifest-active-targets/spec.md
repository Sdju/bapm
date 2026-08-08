# manifest-active-targets Specification

## Purpose

Defines how the project manifest field `active` selects which registered host integrations to activate for materialize/MCP (multi) and compile (single), without conflating that choice with `target` / `targets` preference or package maps.

## Requirements

### Requirement: Manifest active lists hosts to materialize

When the project manifest declares top-level `active` as a non-empty list of valid mf-005 host tokens, install MUST treat that list (after built-in registration and object-map load) as the ordered set of host ids to activate for materialization and eligible MCP configuration, unless a forced CLI `--target` / forced-target option is supplied. Forced target MUST override `active` for that run and MUST activate only the forced id. Omitting `active` MUST preserve today’s detect-then-fail selection when no force is set. Dual-read `apm.yml` MUST honor the same field.

#### Scenario: Sole active materializes without --target or detect

- **WHEN** the manifest declares `active: [cursor]`, cursor is registered, install runs without `--target`, and detect would not select a host
- **THEN** install MUST activate `cursor` and MUST invoke its materialize subject to existing install gates

#### Scenario: Multi active materializes each registered host

- **WHEN** the manifest declares `active: [cursor, x-acme-editor]`, both ids are registered after map load, and install runs without `--target`
- **THEN** install MUST materialize each listed id (subject to intersection/exclude/only-mode) and MUST NOT require filesystem detect

#### Scenario: --target overrides active

- **WHEN** the manifest declares `active: [cursor, x-acme-editor]` and the user runs install with `--target cursor`
- **THEN** install MUST activate only `cursor` and MUST NOT materialize `x-acme-editor` for that run

#### Scenario: Absent active keeps detect path

- **WHEN** the manifest omits `active` and install runs without `--target`
- **THEN** selection MUST follow sole-detect or fail-closed guidance as in `install-pipeline` (not invent activation from `target`/`targets` alone)

### Requirement: Unknown or unregistered active ids fail closed

After built-in registration and successful object-map loading attempts, every id in `active` MUST resolve to a registered integration before any host harness writes for that install. If any id is missing from the registry, the command MUST fail closed with a diagnostic naming the id and MUST NOT partially materialize the remaining listed hosts.

#### Scenario: Active id missing after map load

- **WHEN** the manifest declares `active: [x-missing]` and neither built-in registration nor map load provides `x-missing`
- **THEN** install MUST exit non-zero naming `x-missing` and MUST NOT write harness files for that id

#### Scenario: One unknown among several aborts all

- **WHEN** `active` lists a registered id and an unregistered id together
- **THEN** install MUST fail closed before materializing either listed host

### Requirement: Active does not replace target or targets roles

The field `active` MUST NOT be treated as a substitute for `target` / `targets` declared preference, intersection keys, or object-map package bindings. Declared project target ids for intersection MUST continue to come only from `target` / `targets`. Object-map load MUST continue to follow `target-integration-dynamic-load`. Authors MAY set `active` together with `target` / `targets`.

#### Scenario: Active with object-map still loads packages from map

- **WHEN** the manifest has object-map `targets` binding `x-acme-editor` to a resolvable runtime package and `active: [x-acme-editor]`
- **THEN** the composition root MUST load/register the map package before activation and install MUST be allowed to materialize `x-acme-editor` without `--target`

#### Scenario: Intersection still uses target or targets only

- **WHEN** the project declares `targets: [cursor]` (legacy or map keys) and `active: [cursor]`
- **THEN** package primitive intersection MUST still use declared ids from `target`/`targets`, not invent a second declared set from `active` alone

### Requirement: Compile uses sole active or requires --target

Compile MUST remain single-host. When no `--target` is supplied and `active` contains exactly one registered compile-capable id, compile MUST select that id. When `active` contains more than one id and no `--target` is supplied, compile MUST fail closed with guidance to pass `--target <id>` and MUST NOT write compile output. Forced `--target` MUST override `active`.

#### Scenario: Sole active selects compile host

- **WHEN** `active: [cursor]`, cursor is registered and compile-capable, and compile runs without `--target`
- **THEN** compile MUST use cursor’s compile capability

#### Scenario: Multi active without --target fails compile

- **WHEN** `active` lists two or more ids and `bapm compile` runs without `--target`
- **THEN** compile MUST exit non-zero with guidance to pass `--target <id>` and MUST NOT write compile output

### Requirement: Docs describe active selection

User documentation for the project manifest and install guide MUST document `active` as the explicit host activation list, the selection priority (`--target` → `active` → detect → fail), dual-read on `bapm.yml`/`apm.yml`, and the distinction from `target`/`targets`.

#### Scenario: Config-manifest documents active

- **WHEN** a reader opens the VitePress config-manifest guide after this change
- **THEN** the page MUST describe `active`, selection priority, and that object-map/`target`/`targets` do not by themselves activate hosts
