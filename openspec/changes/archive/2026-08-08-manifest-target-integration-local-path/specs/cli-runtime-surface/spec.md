## MODIFIED Requirements

### Requirement: Install and compile load manifest integration map before core

When the project manifest uses object-map `target` / `targets`, the CLI `install` and `compile` composition paths MUST apply `target-integration-dynamic-load` (resolve, validate, register) against the CLI integration registry after built-in registration and before invoking `@b-apm/core` install or compile orchestration. Map values MAY be npm package specifiers or local filesystem paths as defined by that capability. Legacy string/array manifests MUST keep today’s built-in-only registration behavior. Help text MAY mention that object-map bindings load integration packages or local modules; it MUST continue to document `--target <id>` as the forced-host selector.

#### Scenario: Install loads map then forces custom target

- **WHEN** `runCli(["install", "--target", "x-acme-editor"])` runs in a project whose object-map binds `x-acme-editor` to a resolvable valid runtime integration package
- **THEN** the exit path MUST NOT fail with “unknown or unregistered target” solely because the id was absent from the built-in registry, and materialize MUST be able to proceed through the loaded integration when other install preconditions pass

#### Scenario: Install loads local-path map then forces custom target

- **WHEN** `runCli(["install", "--target", "pi"])` runs in a project whose object-map binds `pi` to a resolvable in-root local path exporting a valid runtime integration
- **THEN** the exit path MUST NOT fail with “unknown or unregistered target” solely because the id was absent from the built-in registry, and materialize MUST be able to proceed through the loaded integration when other install preconditions pass

#### Scenario: Compile loads map then forces custom target

- **WHEN** `runCli(["compile", "--target", "x-acme-editor"])` runs with the same valid object-map binding and the loaded integration exposes compile capability
- **THEN** compile MUST select that registered integration rather than failing as an unknown target id

#### Scenario: Install unknown target after map still fails

- **WHEN** `runCli(["install", "--target", "not-a-host"])` runs and the id is neither built-in nor present as a successful map binding
- **THEN** the return code MUST be non-zero with a clear unknown/unregistered target diagnostic
