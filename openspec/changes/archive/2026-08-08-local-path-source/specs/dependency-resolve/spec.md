## ADDED Requirements

### Requirement: Classify bapm local source as local kind

An object dependency whose sole source discriminator is `local` MUST classify as `kind: local`. The classified path MUST be the effective path after default/custom expansion: default `.agents/local` when `local` has no custom path; otherwise the non-empty `local` string. Classification MUST NOT treat `local` as registry, git, or marketplace. Existing `path:` / string local-prefix classification MUST remain unchanged.

#### Scenario: Default local classifies as local

- **WHEN** a dependency object is `{ local: true }` (or null/empty `local`) with no other source discriminators
- **THEN** the classified kind MUST be `local` and the classified path MUST be `.agents/local` (or an equivalent project-relative form of that default)

#### Scenario: Custom local classifies as local

- **WHEN** a dependency object is `{ local: ./alt }` with no other source discriminators
- **THEN** the classified kind MUST be `local` and the classified path MUST be `./alt` (or the normalized equivalent of that custom string)

#### Scenario: OpenAPM path classification unchanged

- **WHEN** a dependency uses object `path:` or a supported local string prefix without `local`
- **THEN** classification MUST match pre-existing OpenAPM local rules (no dependency on the `local` discriminator)

### Requirement: Resolve expands local before containment and graph read

Graph resolve MUST expand `local` to its effective path before applying project-root containment and before reading the package manifest at that path. Default and custom forms MUST use the same containment and materialization path as ordinary local `path` dependencies after expansion.

#### Scenario: Default local package is read from `.agents/local`

- **WHEN** root declares `{ local: true }` and `.agents/local` contains a valid package manifest inside the project root
- **THEN** the resolver MUST include that package in the graph as a local node

#### Scenario: Custom local uses declared path

- **WHEN** root declares `{ local: ./pkgs/x }` and that path is a valid in-root package
- **THEN** the resolver MUST read and resolve package `x` from that path (not from `.agents/local`)
