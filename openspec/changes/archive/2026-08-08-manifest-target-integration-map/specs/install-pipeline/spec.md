## ADDED Requirements

### Requirement: Object-map target bindings do not load integrations

When the project manifest uses the object-map form of `target` or `targets`, install MUST use only the map **keys** as declared host ids for intersection and related filters. Map **values** (npm package specifiers) MUST be retained on the loaded document for future wiring and MUST NOT, in this capability slice, cause install to download, `require`, register, or otherwise activate an integration package. Active host selection MUST remain `--target` / forced target and registered auto-detect as already specified.

#### Scenario: Map values ignored for activation

- **WHEN** install runs with `targets: { cursor: "@b-apm/integration-cursor" }` and cursor is already registered by the CLI the usual way
- **THEN** install MUST treat `cursor` as a declared host id for intersection and MUST NOT attempt to install or dynamically load `@b-apm/integration-cursor` from the map value alone

#### Scenario: Declared ids from map keys

- **WHEN** a loaded manifest has object-map `targets` with keys `cursor` and `claude`
- **THEN** declared project target ids used for intersection MUST include `cursor` and `claude`

## MODIFIED Requirements

### Requirement: target and targets mutual exclusion and intersection

Manifest parsing/install MUST hard-error when both `target` and `targets` fields are present (OpenAPM tg-008), for legacy string/array forms and for object-map forms. When integrating, primitives from a package MUST be deployed only into the intersection of active project targets, consumer-authorized targets, and package-declared targets. Declared project target ids MUST be taken from: the single string when `target` is a string; each element when `targets` is a string array; or each key when `target` / `targets` is an object map. Vendor-style ids matching `x-<vendor>-<name>` MUST be accepted as target identifiers (tg-004); deploy MUST occur only if a package is registered for that id.

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
