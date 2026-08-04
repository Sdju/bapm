## ADDED Requirements

### Requirement: Scoped update holds non-targeted pins
When resolve runs in update mode with an explicit package scope set, the resolver MUST re-resolve only the scoped package identities and their transitive subtrees. Lock pins for non-scoped direct dependencies MUST remain character-identical for identity and resolved commit/tag fields that define the pin. Full (unscoped) update mode MUST continue to re-resolve every direct dependency against current manifest constraints (rs-011/rs-012).

#### Scenario: Scoped update leaves sibling pin unchanged
- **WHEN** update-mode resolve is scoped to package A while B is also a direct dep
- **THEN** B's lock pin fields that define the pin MUST remain identical while A and its subtree MAY change

### Requirement: Update purge before re-download for git-semver (lk-010)
When update-mode resolve targets a direct git-semver dependency, the system MUST purge that dependency's modules install path before download/materialize so content is re-fetched even if the satisfying tag is unchanged (lk-010).

#### Scenario: Purge runs before download on update
- **WHEN** update mode targets a git-semver direct dep whose modules path exists
- **THEN** that path MUST be removed (or equivalently emptied) before the download step for that package runs
