## MODIFIED Requirements

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

#### Scenario: Root declared targets narrow other active hosts

- **WHEN** the project manifest declares `targets: { cursor: "@b-apm/integration-cursor" }` and install runs with `--target claude` (claude registered)
- **THEN** install MUST NOT deploy package primitives to claude, because `claude` is not among the declared project target ids

#### Scenario: Object-map package registered then forced target materializes

- **WHEN** the project manifest declares object-map `targets` with `x-acme-editor` bound to a resolvable valid runtime integration package and install runs with `--target x-acme-editor`
- **THEN** after map load registers that id, install MUST be allowed to materialize through the registered integration subject to intersection rules

#### Scenario: Active does not expand declared preference

- **WHEN** the project manifest declares `targets: [cursor]` and `active: { target: [cursor, claude] }`
- **THEN** declared project target ids for intersection MUST still come from `target`/`targets` only
