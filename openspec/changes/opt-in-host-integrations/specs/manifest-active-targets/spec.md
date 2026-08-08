## MODIFIED Requirements

### Requirement: Manifest active lists hosts to materialize

When the project manifest declares top-level `active` as a non-empty list of valid mf-005 host tokens, install MUST treat that list (after object-map registration for the run) as the ordered set of host ids to activate for materialization and eligible MCP configuration, unless a forced CLI `--target` / forced-target option is supplied. Forced target MUST override `active` for that run and MUST activate only the forced id. Omitting `active` MUST preserve today’s detect-then-fail selection when no force is set. Dual-read `apm.yml` MUST honor the same field. `active` MUST NOT rely on eagerly built-in host registrations from the CLI.

#### Scenario: Sole active materializes without --target or detect

- **WHEN** the manifest declares `active: [cursor]`, cursor is registered via object-map, install runs without `--target`, and detect would not select a host
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

After successful object-map loading attempts (when present) and with no eager built-in host registrations, every id in `active` MUST resolve to a registered integration before any host harness writes for that install. If any id is missing from the registry, the command MUST fail closed with a diagnostic naming the id and MUST NOT partially materialize the remaining listed hosts.

#### Scenario: Active id missing after map load

- **WHEN** the manifest declares `active: [x-missing]` and map load does not provide `x-missing`
- **THEN** install MUST exit non-zero naming `x-missing` and MUST NOT write harness files for that id

#### Scenario: One unknown among several aborts all

- **WHEN** `active` lists a registered id and an unregistered id together
- **THEN** install MUST fail closed before materializing either listed host
