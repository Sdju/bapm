## MODIFIED Requirements

### Requirement: Resolve authoring packages to concrete refs
When emitting marketplace outputs, the system MUST load the project authoring config (same detect/load rules as authoring) and resolve each package entry to a concrete resolved form before mapping. Local sources beginning with `./` MUST pass through as path strings without network access. Remote default-host GitHub `owner/repo` entries MUST resolve via thin ambient `git ls-remote` (or equivalent) to a concrete `ref` and `sha`, respecting explicit `ref`, or `version` ranges with `build.tagPattern` / per-entry `tag_pattern`. Unlocked non-github remotes (GitHub enterprise, gitlab, ado) MUST resolve using thin env tokens and/or ambient git when available. When a remote cannot produce a concrete ref/sha (no token, unreachable host, or generic `git` kind still refused), resolve MUST fail closed with an actionable error. Resolve MUST NOT silently emit an empty `plugins` list when packages were configured.

#### Scenario: Local package skips network
- **WHEN** pack marketplace emit runs for a package with `source: ./plugins/demo`
- **THEN** resolution MUST succeed without network probes and the mapped entry MUST use the local path form

#### Scenario: GitHub shorthand resolves to sha
- **WHEN** pack marketplace emit runs online for a package with source `acme/tools` and a resolvable `ref` or matching tag from the configured tag pattern
- **THEN** the resolved package MUST include a concrete `sha` (and effective `ref`) before write

#### Scenario: Unresolvable remote fails closed
- **WHEN** resolve cannot obtain a concrete ref/sha for a configured remote package (including offline without usable cache)
- **THEN** the pack marketplace path MUST exit non-zero with an actionable error and MUST NOT write a host marketplace.json that omits that package silently

#### Scenario: Unlocked gitlab remote resolves with thin token
- **WHEN** pack marketplace emit runs for a gitlab remote package and a GitLab-class env token enables `git ls-remote` (or equivalent) to succeed
- **THEN** resolve MUST produce a concrete ref/sha and MUST NOT fail solely because hosts-auth was previously out of scope
