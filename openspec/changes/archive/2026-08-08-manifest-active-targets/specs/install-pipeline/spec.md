## MODIFIED Requirements

### Requirement: Install selects only an unambiguous registered target

For install materialization and MCP configuration, core MUST resolve the active host id list in this order: (1) an explicit forced registered target id (for example CLI `--target`) selects that single id and overrides other sources; (2) else when the loaded project manifest has a non-empty `active` list, those ids (after built-in registration and object-map load) become the active set; (3) else when exactly one registered integration is detected for the project cwd, that id is selected; (4) else install MUST fail before target harness writes with guidance to pass `--target <id>` and/or set manifest `active`. An unknown forced id or any unknown id in `active` MUST fail closed. When `active` lists multiple registered ids, install MUST materialize each (subject to intersection, exclude, and only-mode) and MUST NOT require filesystem detect for those ids.

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

### Requirement: target and targets mutual exclusion and intersection

Manifest parsing/install MUST hard-error when both `target` and `targets` fields are present (OpenAPM tg-008), for legacy string/array forms and for object-map forms. When integrating, primitives from a package MUST be deployed only into the intersection of active project targets, consumer-authorized targets, and package-declared targets. Declared project target ids MUST be taken from: the single string when `target` is a string; each element when `targets` is a string array; or each key when `target` / `targets` is an object map. Vendor-style ids matching `x-<vendor>-<name>` MUST be accepted as target identifiers (tg-004); deploy MUST occur only if a package is registered for that id. When the object-map form is used, registration of integrations named by map values MUST follow `target-integration-dynamic-load` before forced-target, manifest-`active`, and detect selection; map values MUST NOT replace `--target`, manifest `active`, or auto-detect as the source of truth for which host id is active. The separate `active` field MUST NOT contribute declared preference ids for intersection.

#### Scenario: Mutual exclusion of target fields

- **WHEN** a manifest contains both `target` and `targets`
- **THEN** parse or install MUST fail closed before deploy

#### Scenario: Intersection skips non-overlapping package targets

- **WHEN** the project active target is `cursor` and a dependency declares `targets: [copilot]`
- **THEN** that dependency's primitives MUST NOT be deployed to the cursor target

#### Scenario: Vendor target id accepted

- **WHEN** a manifest uses `target: x-acme-editor`
- **THEN** validation MUST accept the id as a vendor target id; deploy MUST happen only if that id is registered

#### Scenario: Object-map keys participate in intersection

- **WHEN** the project manifest declares object-map `targets` whose keys include `cursor` and a dependency declares `targets: [copilot]` only
- **THEN** that dependency's primitives MUST NOT be deployed to an active cursor target (non-overlapping declared ids)

#### Scenario: Object-map package registered then forced target materializes

- **WHEN** the project manifest declares object-map `targets` with `x-acme-editor` bound to a resolvable valid runtime integration package and install runs with `--target x-acme-editor`
- **THEN** after map load registers that id, install MUST be allowed to materialize through the registered integration subject to intersection rules

#### Scenario: Active does not expand declared preference

- **WHEN** the project manifest declares `targets: [cursor]` and `active: [cursor]` (or additional registered ids only via `active`)
- **THEN** declared project target ids for intersection MUST still come from `target`/`targets` only
