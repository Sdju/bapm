# target-integration-dynamic-load Specification

## Purpose

Defines how bapm resolves, validates, and registers runtime host integrations from the manifest object-map `target` / `targets` so authors can publish npm packages and activate them via `--target` / detect without replacing built-in registration or active-host selection rules.

## Requirements

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

### Requirement: Built-in cursor remains without mandatory map entry

The CLI distribution MUST continue to register the built-in Cursor runtime integration without requiring a `cursor` key in the object map. Object-map registration is an extension of the built-in registry, not a replacement of it.

#### Scenario: Cursor works without map row

- **WHEN** the manifest has no object-map (or an object-map without `cursor`) and install runs with `--target cursor` (or detect selects cursor)
- **THEN** cursor MUST remain usable via the built-in registration

#### Scenario: Map may override cursor

- **WHEN** the object-map includes `cursor: "<specifier>"` and that package loads as a valid runtime integration with `id` `cursor`
- **THEN** the loaded integration MUST be registered for `cursor` (replacing the built-in instance for that run)

### Requirement: Fail-closed for unknown forced target after map load

After built-in registration and object-map loading attempts, when the caller forces a target id (for example CLI `--target <id>`) that is still not present in the registry, the command MUST fail closed with a clear diagnostic that names the id and indicates it is neither a built-in/registered integration nor a successfully loaded map binding.

#### Scenario: Forced id missing from registry and map

- **WHEN** the user passes `--target x-missing` and neither the built-in registry nor a successful map load provides `x-missing`
- **THEN** install or compile MUST exit non-zero with a diagnostic naming `x-missing` and MUST NOT materialize or write compile output for that id

### Requirement: Fail-closed for unresolvable or invalid mapped packages

When the object-map form is present, every map entry MUST successfully resolve and yield a valid runtime integration before active-host selection proceeds. If a specifier (npm package or local path) cannot be resolved, the path is missing, the module does not export a valid runtime `BapmIntegration` (including marketplace-output-only exports), or the loaded integration’s `id` does not equal the map key, the command MUST fail closed with a diagnostic naming the host id, the specifier, and the failure class. Partial success that leaves broken declared bindings unregistered MUST NOT occur.

#### Scenario: Unresolvable package specifier

- **WHEN** the map contains `x-acme-editor: "@acme/does-not-exist"` and Node cannot resolve that package from the project
- **THEN** install or compile MUST fail closed before materialize/compile writes and MUST name the id and specifier

#### Scenario: Missing local path fails closed

- **WHEN** the map contains `pi: "./agents/integration/missing"` and that path does not exist or cannot be resolved as a module under the project root
- **THEN** install or compile MUST fail closed before materialize/compile writes and MUST name the id and specifier

#### Scenario: Marketplace-only package rejected

- **WHEN** the map points a host id at a package that exports only marketplace-output capability without runtime `detect` / `materialize`
- **THEN** the command MUST fail closed indicating the package is not a valid runtime integration

#### Scenario: Integration id mismatches map key

- **WHEN** a mapped package or local module loads an integration whose `id` is not equal to the map key
- **THEN** the command MUST fail closed and MUST NOT register that integration under the map key

### Requirement: Loadable package export contract

A package referenced by an object-map value MUST be loadable as a runtime integration by exposing, in documented precedence, a factory or object that produces a `BapmIntegration` conforming to `@bapm/integration-api`: at least `id`, `deployRoots`, `detect`, and `materialize`. Third-party packages SHOULD export a named `createIntegration` factory; a default-export factory or default-export `BapmIntegration` object MUST also be accepted when they satisfy the same contract. Optional `configureMcp` and `compile` capabilities MUST be preserved when present.

#### Scenario: createIntegration factory accepted

- **WHEN** a mapped package’s public entry exports `createIntegration` returning a valid `BapmIntegration` whose `id` matches the map key
- **THEN** loading MUST succeed and register that instance

#### Scenario: Default-export integration object accepted

- **WHEN** a mapped package’s default export is a valid `BapmIntegration` object whose `id` matches the map key
- **THEN** loading MUST succeed and register that instance

### Requirement: Specifier form for v1

Object-map values remain non-empty opaque strings as already validated by manifest parse. For dynamic load, the system MUST classify each value as either a **local filesystem path** or an **npm package specifier** using Node-like heuristics: values that begin with `./`, `../`, or an absolute filesystem root (`/` on POSIX; a drive-letter absolute form on Windows) MUST be treated as local paths; all other values MUST be treated as npm package specifiers. Local paths MUST be resolved relative to the project / manifest cwd (dual-read root). Directory paths MUST use Node module resolution against that root (package.json `exports` / `main`, then `index.*` as Node provides). Explicit files that Node resolution already accepts (for example `.js` / `.mjs` / `.cjs` entry files) MUST be loadable when pointed to directly. Bare package names without a path prefix (including scoped packages) MUST continue to resolve as npm packages. The system MUST NOT introduce a separate first-class `path:` / `workspace:` integration-map URI scheme in this capability. Network installation of a mapped npm package as a side effect of load MUST NOT be required for success when the package is already resolvable.

#### Scenario: Project-resolvable npm package loads

- **WHEN** `@acme/integration-editor` is installed such that Node resolves it from the project cwd and the map references that specifier
- **THEN** load MUST use that resolution and MUST NOT fail solely because bapm did not download the package itself

#### Scenario: Relative directory path loads via Node resolution

- **WHEN** the map value is `./agents/integration/pi-agent`, that directory exists under the project root, and Node module resolution from the project cwd yields a loadable entry exporting a valid runtime integration
- **THEN** load MUST succeed using that resolved entry

#### Scenario: Explicit file path loads when Node accepts it

- **WHEN** the map value is `./agents/integration/pi-agent/index.js` (or another entry file Node resolution accepts) under the project root and the module exports a valid runtime integration
- **THEN** load MUST succeed

#### Scenario: Bare name remains npm package

- **WHEN** the map value is `my-integration` or `@acme/my-integration` without a `./`, `../`, or absolute path prefix
- **THEN** load MUST treat it as an npm package specifier and MUST NOT interpret it as a relative filesystem path

#### Scenario: Dedicated path URI scheme not required

- **WHEN** an author uses only the documented npm package string form or a `./` / absolute filesystem path form
- **THEN** load MUST NOT require a `path:`-prefixed integration map grammar to succeed

### Requirement: Local map paths stay within project root

Local filesystem map values MUST resolve to a location contained under the project / manifest cwd (dual-read root). After normalizing the path relative to that root, if the result escapes the project root (including `../` traversal and absolute paths outside the root), load MUST fail closed with a diagnostic naming the host id and specifier, and MUST NOT import or register the module. Lexical containment under the project root is required; following symlinks outside the root is out of scope for this requirement unless already enforced by shared helpers.

#### Scenario: Relative escape fails closed

- **WHEN** the map value is `../outside-integration` (or another relative form that normalizes outside the project root)
- **THEN** install or compile MUST fail closed without importing that module and MUST name the id and specifier

#### Scenario: Absolute path outside project fails closed

- **WHEN** the map value is an absolute filesystem path that lies outside the project root
- **THEN** install or compile MUST fail closed without importing that module

#### Scenario: In-root relative path allowed

- **WHEN** the map value is `./agents/integration/pi-agent` and that path normalizes inside the project root to a valid runtime integration
- **THEN** load MUST be allowed by the containment check
