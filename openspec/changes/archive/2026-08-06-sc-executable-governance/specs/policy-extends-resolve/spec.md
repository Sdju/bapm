## ADDED Requirements

### Requirement: Merge executables deny_all OR and deny union

Along an `extends:` chain, effective `executables.deny_all` MUST be the logical OR of ancestors and leaf (any true wins). Effective `executables.deny` MUST be the union of deny lists (deduped; parent order preserved then child additions). Recommend/enforce/require under executables MUST NOT be required for merge correctness of this claim floor.

#### Scenario: deny_all OR across extends

- **WHEN** a parent policy sets `executables.deny_all: true` and the leaf sets `deny_all: false` or omits it
- **THEN** the merged effective policy MUST have `executables.deny_all: true`

#### Scenario: deny lists union across extends

- **WHEN** a parent denies `org/a` and the leaf denies `org/b`
- **THEN** the merged effective `executables.deny` MUST include both `org/a` and `org/b`
