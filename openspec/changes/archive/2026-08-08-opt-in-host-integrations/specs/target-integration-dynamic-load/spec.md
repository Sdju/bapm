## REMOVED Requirements

### Requirement: Built-in cursor remains without mandatory map entry

**Reason:** Product decision — host integrations (including Cursor) MUST NOT be eagerly registered as CLI built-ins; authors install `@bapm/integration-cursor` (or another package) and declare it via object-map.

**Migration:** Declare `targets: { cursor: "@bapm/integration-cursor" }` (or equivalent object-map entry), install the package in the project or alongside the CLI, then use `--target cursor` / `active` / detect as before.

## MODIFIED Requirements

### Requirement: Object-map supplies integration packages for registration

When the project manifest uses the object-map form of `target` or `targets`, the CLI composition root MUST, before install or compile active-host selection, resolve each map value as either an npm package specifier or a local filesystem path (per specifier-form rules), load a runtime `BapmIntegration` from that module, and register it on the integration registry under the corresponding map key. Legacy string or string-array `target` / `targets` MUST NOT trigger package or path loading from those fields and MUST NOT imply a built-in host registration for those ids. The map MUST NOT by itself select which host id is active for the run; activation MUST continue to require CLI `--target` / forced override, a non-empty manifest `active` list, or unambiguous auto-detect per `install-pipeline` / `manifest-active-targets`.

#### Scenario: Map entry registers custom host before selection

- **WHEN** the manifest declares `targets: { "x-acme-editor": "@acme/integration-editor" }`, the package resolves and exports a valid runtime integration whose `id` is `x-acme-editor`, and the user runs install or compile with `--target x-acme-editor`
- **THEN** the composition root MUST register that integration and core MUST treat `x-acme-editor` as a registered target for forced activation and materialize/compile

#### Scenario: Map entry registers host from local path

- **WHEN** the manifest declares `targets: { "pi": "./agents/integration/pi-agent" }`, that path resolves under the project root to a valid runtime integration whose `id` is `pi`, and the user runs install or compile with `--target pi`
- **THEN** the composition root MUST register that integration and MUST treat `pi` as a registered target for forced activation and materialize/compile

#### Scenario: Legacy string target does not load packages

- **WHEN** the manifest declares `target: cursor` (string form) without an object map
- **THEN** the composition root MUST NOT attempt to dynamically load an integration package or path from the `target` field value and MUST NOT register `cursor` solely because the string id is present

#### Scenario: Map does not pick active host without detect, --target, or active

- **WHEN** an object-map declares one or more keys and the user runs install without `--target`, without a non-empty manifest `active`, and no registered integration detects
- **THEN** the run MUST fail closed asking for `--target <id>` (or equivalent / setting `active`) and MUST NOT activate a host solely because it appears as a map key

#### Scenario: Map plus active activates without --target

- **WHEN** an object-map registers `x-acme-editor` and the manifest also declares `active: [x-acme-editor]`, and install runs without `--target`
- **THEN** after map load, install MUST be allowed to activate `x-acme-editor` via `active` without requiring detect

### Requirement: Fail-closed for unknown forced target after map load

After object-map loading attempts (when an object-map is present) and with no eager built-in host registrations, when the caller forces a target id (for example CLI `--target <id>`) that is still not present in the registry, the command MUST fail closed with a clear diagnostic that names the id and indicates it is not a successfully loaded map binding (and SHOULD hint to install the integration package and declare it under object-map `targets:` / `target:`).

#### Scenario: Forced id missing from registry and map

- **WHEN** the user passes `--target x-missing` and no successful map load provides `x-missing`
- **THEN** install or compile MUST exit non-zero with a diagnostic naming `x-missing` and MUST NOT materialize or write compile output for that id

#### Scenario: Cursor without map fails closed

- **WHEN** the user passes `--target cursor` and the manifest has no object-map binding that successfully registers `cursor`
- **THEN** install or compile MUST exit non-zero with a diagnostic naming `cursor` and MUST NOT treat cursor as a built-in registered host

## ADDED Requirements

### Requirement: Composition root starts with empty runtime integration registry

The CLI composition root MUST construct the runtime integration registry without eagerly registering `@bapm/integration-cursor` or any other concrete host integration package. Hosts become registered for a run only through successful object-map load (or an equivalent documented non-eager load path used by tests). The CLI distribution MUST NOT hard-depend on concrete `@bapm/integration-*` runtime packages solely to auto-register them at startup.

#### Scenario: Empty registry without object-map

- **WHEN** install or compile runs against a manifest with no object-map `target` / `targets`
- **THEN** the runtime integration registry MUST contain no eagerly built-in host integrations from the CLI composition root

#### Scenario: Cursor registers only via map

- **WHEN** the manifest object-map binds `cursor: "@bapm/integration-cursor"`, that package resolves to a valid runtime integration with `id` `cursor`, and install runs with `--target cursor`
- **THEN** cursor MUST be registered from the map load and materialize MUST be allowed to proceed through that integration when other install preconditions pass
