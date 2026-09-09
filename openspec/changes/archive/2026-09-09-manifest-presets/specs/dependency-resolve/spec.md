## ADDED Requirements

### Requirement: Resolve uses base deps unioned with included presets

Before classifying and BFS-resolving the project graph, the system MUST compute effective direct dependency maps as the union of the base manifest `dependencies` / `devDependencies` with those maps from every preset included by effective structured `active` (per `manifest-presets`). Resolve, lock populate, and non-frozen install MUST consume that effective set. Selecting only target ids in `active` MUST NOT add preset packages. When no preset is included, behavior MUST match base-only resolve. Conflicting declarations for the same direct package name across base and included presets MUST fail closed before download or lock write.

#### Scenario: Included preset packages enter the graph

- **WHEN** base has no dependencies, preset `analyst` declares a resolvable direct package, and effective `active` includes `preset: analyst`
- **THEN** resolve MUST include that package in the graph and lock output

#### Scenario: Target-only active does not pull preset packages

- **WHEN** presets define packages but effective `active` is only `{ target: cursor }`
- **THEN** resolve MUST NOT include those preset packages unless also present on the base maps
