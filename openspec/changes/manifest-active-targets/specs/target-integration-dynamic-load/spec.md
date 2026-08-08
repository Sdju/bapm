## MODIFIED Requirements

### Requirement: Object-map supplies integration packages for registration

When the project manifest uses the object-map form of `target` or `targets`, the CLI composition root MUST, before install or compile active-host selection, resolve each map value as either an npm package specifier or a local filesystem path (per specifier-form rules), load a runtime `BapmIntegration` from that module, and register it on the integration registry under the corresponding map key. Legacy string or string-array `target` / `targets` MUST NOT trigger package or path loading from those fields. The map MUST NOT by itself select which host id is active for the run; activation MUST continue to require CLI `--target` / forced override, a non-empty manifest `active` list, or unambiguous auto-detect per `install-pipeline` / `manifest-active-targets`.

#### Scenario: Map entry registers custom host before selection

- **WHEN** the manifest declares `targets: { "x-acme-editor": "@acme/integration-editor" }`, the package resolves and exports a valid runtime integration whose `id` is `x-acme-editor`, and the user runs install or compile with `--target x-acme-editor`
- **THEN** the composition root MUST register that integration and core MUST treat `x-acme-editor` as a registered target for forced activation and materialize/compile

#### Scenario: Map entry registers host from local path

- **WHEN** the manifest declares `targets: { "pi": "./agents/integration/pi-agent" }`, that path resolves under the project root to a valid runtime integration whose `id` is `pi`, and the user runs install or compile with `--target pi`
- **THEN** the composition root MUST register that integration and MUST treat `pi` as a registered target for forced activation and materialize/compile

#### Scenario: Legacy string target does not load packages

- **WHEN** the manifest declares `target: cursor` (string form) without an object map
- **THEN** the composition root MUST NOT attempt to dynamically load an integration package or path from the `target` field value

#### Scenario: Map does not pick active host without detect, --target, or active

- **WHEN** an object-map declares one or more keys and the user runs install without `--target`, without a non-empty manifest `active`, and no registered integration detects
- **THEN** the run MUST fail closed asking for `--target <id>` (or equivalent / setting `active`) and MUST NOT activate a host solely because it appears as a map key

#### Scenario: Map plus active activates without --target

- **WHEN** an object-map registers `x-acme-editor` and the manifest also declares `active: [x-acme-editor]`, and install runs without `--target`
- **THEN** after map load, install MUST be allowed to activate `x-acme-editor` via `active` without requiring detect
