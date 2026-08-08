## MODIFIED Requirements

### Requirement: Composition root registers available integration packages

The application composition root MUST obtain a shared integration registry and, when the project declares an object-map of host integrations, load and register those packages before passing the registry to core compile or install orchestration. The composition root MUST NOT eagerly register concrete `@bapm/integration-*` packages as built-ins of the CLI distribution. Core MUST remain independent of concrete integration package imports, and tests MUST be able to provide a registry containing arbitrary integration doubles.

#### Scenario: CLI registers packaged integrations outside core

- **WHEN** CLI runs compile or install for a project whose object-map binds `cursor` to a resolvable `@bapm/integration-cursor` (or another valid runtime package with `id` `cursor`)
- **THEN** the composition root MUST register that Cursor integration before invoking core, while `@bapm/core` MUST not import that package

#### Scenario: CLI does not auto-register Cursor without declaration

- **WHEN** CLI runs compile or install without an object-map binding that loads a `cursor` integration
- **THEN** the composition root MUST NOT register Cursor solely because the CLI package historically depended on `@bapm/integration-cursor`
