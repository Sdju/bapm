## ADDED Requirements

### Requirement: Classify retains consumer skill and target subsets

When classifying an object-form dependency that parsed with `skills` and/or `targets` lists, the classified result (and the corresponding resolved graph node after `resolveAndLock`) MUST carry those subsets as data for install. Classification kind, download, and lock identity MUST NOT change solely because a subset is present. String-form declarations MUST continue to carry no subset. Subset MUST NOT shrink what is fetched into the modules cache.

#### Scenario: Registry object-form subset survives classify

- **WHEN** a dependency object `{ id: acme/toolkit, version: 1.0.0, skills: [alpha], targets: [cursor] }` is classified
- **THEN** the classified kind MUST remain `registry` and the classified result MUST expose skill subset `[alpha]` and target subset `[cursor]`

#### Scenario: Git object-form subset survives classify

- **WHEN** a dependency object `{ git: https://github.com/acme/toolkit.git, skills: [alpha] }` is classified
- **THEN** the classified git kind MUST be unchanged and the classified result MUST expose skill subset `[alpha]`

#### Scenario: Subset does not skip download

- **WHEN** resolve downloads a git or registry package whose declaring entry has `skills: [alpha]` while the package tree also contains other skills
- **THEN** the modules cache MUST still contain the full package tree (subset is not a fetch filter)
