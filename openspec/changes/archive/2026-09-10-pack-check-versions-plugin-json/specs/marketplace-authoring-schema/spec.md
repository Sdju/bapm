## ADDED Requirements

### Requirement: marketplace.versioning.strategy is typed for pack gates

The marketplace authoring loader MUST parse optional `marketplace.versioning` as a mapping that MAY include `strategy`. Allowed `strategy` values MUST be exactly `lockstep`, `tag_pattern`, and `per_package`. When `versioning` is omitted, or `strategy` is omitted inside it, the effective strategy for consumers of authoring config MUST default to `lockstep`. An unknown `strategy` string MUST fail closed at load/validation time. The loader MUST retain the typed strategy on the authoring config for `pack --check-versions` (and MUST NOT require host marketplace.json emit as a side effect of parsing versioning).

#### Scenario: Default strategy is lockstep

- **WHEN** a valid `marketplace:` block omits `versioning`
- **THEN** the loaded authoring config MUST expose effective strategy `lockstep` (or equivalent default) for version-alignment consumers

#### Scenario: Explicit tag_pattern retained

- **WHEN** `marketplace.versioning.strategy` is `tag_pattern`
- **THEN** load MUST succeed and the loaded config MUST expose strategy `tag_pattern`

#### Scenario: Unknown strategy fails closed

- **WHEN** `marketplace.versioning.strategy` is a string outside the allowed set
- **THEN** loading MUST fail closed with a clear validation error
