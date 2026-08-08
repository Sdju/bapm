## MODIFIED Requirements

### Requirement: Install selects only an unambiguous registered target

For install materialization and MCP configuration, core MUST resolve the active host id list in this order: (1) an explicit forced registered target id (for example CLI `--target`) selects that single id and overrides other sources; (2) else when the loaded project manifest has a non-empty `active` list, those ids (after object-map registration for the run) become the active set; (3) else when exactly one registered integration is detected for the project cwd, that id is selected; (4) else install MUST fail before target harness writes with guidance to pass `--target <id>` and/or set manifest `active`. An unknown forced id or any unknown id in `active` MUST fail closed. When `active` lists multiple registered ids, install MUST materialize each (subject to intersection, exclude, and only-mode) and MUST NOT require filesystem detect for those ids. Selection MUST NOT assume any eagerly built-in host is present in the registry.

#### Scenario: Sole detected target deploys automatically

- **WHEN** install runs without an explicit target, without manifest `active`, and exactly one registered integration positively detects the project
- **THEN** install MUST invoke that integration's eligible materialize and MCP capabilities

#### Scenario: No target detection requires explicit target

- **WHEN** install runs without an explicit target, without manifest `active`, and no registered integrations positively detect the project
- **THEN** install MUST fail with guidance to pass `--target <id>` (and MAY mention setting `active`) and MUST NOT write target harness files

#### Scenario: Ambiguous target detection requires explicit target

- **WHEN** install runs without an explicit target, without manifest `active`, and two or more registered integrations positively detect the project
- **THEN** install MUST fail with guidance to pass `--target <id>` (and MAY mention setting `active`) and MUST NOT write target harness files

#### Scenario: Manifest active selects without detect

- **WHEN** install runs without `--target`, the manifest declares a non-empty `active` list of registered ids, and detect is absent or ambiguous
- **THEN** install MUST activate those ids and MUST invoke eligible materialize/MCP for each

#### Scenario: Forced target overrides manifest active

- **WHEN** the manifest declares `active` with multiple registered ids and install is invoked with a forced registered target id
- **THEN** install MUST activate only the forced id for that run
