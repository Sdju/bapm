## REMOVED Requirements

### Requirement: Object-map target bindings do not load integrations

**Reason:** Replaced by `target-integration-dynamic-load` and the modified intersection requirement below: object-map values are now the declared source of which package to register for a host id, while active-host selection remains `--target` / detect.

**Migration:** Composition roots MUST load and register map packages before selection; intersection continues to use map keys only. See `target-integration-dynamic-load` for fail-closed and built-in cursor rules.

## MODIFIED Requirements

### Requirement: target and targets mutual exclusion and intersection

Manifest parsing/install MUST hard-error when both `target` and `targets` fields are present (OpenAPM tg-008), for legacy string/array forms and for object-map forms. When integrating, primitives from a package MUST be deployed only into the intersection of active project targets, consumer-authorized targets, and package-declared targets. Declared project target ids MUST be taken from: the single string when `target` is a string; each element when `targets` is a string array; or each key when `target` / `targets` is an object map. Vendor-style ids matching `x-<vendor>-<name>` MUST be accepted as target identifiers (tg-004); deploy MUST occur only if a package is registered for that id. When the object-map form is used, registration of integrations named by map values MUST follow `target-integration-dynamic-load` before forced-target and detect selection; map values MUST NOT replace `--target` / auto-detect as the source of truth for which host id is active.

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
