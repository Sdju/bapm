## ADDED Requirements

### Requirement: Effective active uses merged local overlay

When resolving host activation, the system MUST use the **effective** `active` list after applying `bapm.local.yml` over the base dual-read manifest (per `manifest-local-overlay`). Forced CLI `--target` / forced-target MUST still override effective `active`. Object-map integration packages MUST load from the effective `target` / `targets` maps after the same merge. Omitting `active` from both base and local MUST preserve detect-then-fail selection when no force is set.

#### Scenario: Local active used when base omits active

- **WHEN** base omits `active`, `bapm.local.yml` declares `active: [cursor]`, cursor is registered, and install runs without `--target`
- **THEN** install MUST activate `cursor` without requiring filesystem detect

#### Scenario: Local object-map loads before activation

- **WHEN** `bapm.local.yml` provides an object-map `targets` binding `x-acme-editor` and `active: [x-acme-editor]`, and the package is resolvable
- **THEN** the composition root MUST load/register that map package before activation using the effective map

## MODIFIED Requirements

### Requirement: Docs describe active selection

User documentation for the project manifest and install guide MUST document `active` as the explicit host activation list, the selection priority (`--target` → `bapm.local.yml` → base `active` → detect → fail), dual-read on `bapm.yml`/`apm.yml`, optional personal overlay `bapm.local.yml`, and the distinction from `target`/`targets`.

#### Scenario: Config-manifest documents active

- **WHEN** a reader opens the VitePress config-manifest guide after this change
- **THEN** the page MUST describe `active`, selection priority including local overlay, and that object-map/`target`/`targets` do not by themselves activate hosts
