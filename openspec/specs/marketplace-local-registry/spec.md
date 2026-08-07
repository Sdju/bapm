# marketplace-local-registry Specification

## Purpose

Defines the `~/.bapm` user-config root and durable local registry CRUD for
registered marketplace sources in `marketplaces.json`, independent of the
package Registry HTTP client and of project cwd.

## Requirements

### Requirement: Config root is ~/.bapm only

The system MUST resolve the marketplace config directory to the user's home under `.bapm` (i.e. `~/.bapm`). Helpers MUST ensure the directory exists with appropriate permissions when creating registry or cache paths. This change MUST NOT read or write `~/.apm` paths. Registry file path MUST be `~/.bapm/marketplaces.json`. Cache root for marketplace sidecars MUST be `~/.bapm/cache/marketplace/`.

#### Scenario: Ensure config creates marketplaces.json skeleton

- **WHEN** registry load runs and `~/.bapm/marketplaces.json` is absent
- **THEN** the system MUST create `~/.bapm` if needed and write `{ "marketplaces": [] }` (or equivalent empty list shape) before returning an empty list

#### Scenario: No ~/.apm dependency

- **WHEN** marketplace registry or cache paths are resolved
- **THEN** resolved paths MUST be under `~/.bapm` and MUST NOT reference `~/.apm`

### Requirement: Registry CRUD with case-insensitive names

The registry document shape MUST be `{ "marketplaces": [ /* serialized MarketplaceSource entries */ ] }`. The system MUST support list-all, get-by-name (case-insensitive), add (replace existing entry with the same name case-insensitively), and remove-by-name. Get/remove of a missing name MUST fail with a clear not-found error. Saves MUST be atomic (write temp then rename/replace). Cross-process file locking is optional; atomic replace is sufficient for v1.

#### Scenario: Add replaces same name ignoring case

- **WHEN** a marketplace named `Acme` is registered and a caller adds another source with name `acme`
- **THEN** the registry MUST contain exactly one entry for that name reflecting the new source

#### Scenario: Remove missing name fails

- **WHEN** a caller removes a name that is not registered
- **THEN** the operation MUST fail with a not-found error and leave the file unchanged

#### Scenario: Atomic save survives interruption of the final rename

- **WHEN** registry save writes through a temporary sibling then replaces the target
- **THEN** readers MUST either see the previous complete JSON or the new complete JSON, never a partial file

### Requirement: Orthogonal to Registry HTTP module

Marketplace registry persistence MUST live in the Marketplace domain module and MUST NOT import or reuse the package Registry HTTP client, experimental registries env gate, or publish/self-update helpers for `marketplace.json` I/O.

#### Scenario: Registry HTTP client unused for marketplaces.json

- **WHEN** marketplace list/add/remove runs against local config
- **THEN** execution MUST NOT require `BAPM_EXPERIMENTAL_REGISTRIES` and MUST NOT call package-registry HTTP APIs
