## ADDED Requirements

### Requirement: Root resolve includes devDependencies.apm

When resolving the project root graph for local install (and equivalent resolveAndLock / install resolve paths), the resolver MUST treat entries under `devDependencies.apm` as root APM dependencies alongside `dependencies.apm` (union; declaration-order semantics MUST remain deterministic and documented). Child package manifests MUST continue to contribute only their `dependencies` (not their `devDependencies`) to the transitive graph. Absence of `devDependencies` MUST behave as today (dependencies-only root). This inclusion MUST NOT imply that pack/export ships `devDependencies` (pack filtering remains a separate concern).

#### Scenario: Root devDependency is installed

- **WHEN** the project manifest lists a package only under `devDependencies.apm` and install/resolve runs without excluding that root set
- **THEN** the resolver MUST include that package in the root install graph and a successful non-frozen install MUST materialize it like other root APM deps

#### Scenario: Child devDependencies stay out of transitive graph

- **WHEN** a resolved child package manifest declares `devDependencies.apm`
- **THEN** those child `devDependencies` MUST NOT be pulled into the parent project’s transitive install graph solely as root-style deps of the child
