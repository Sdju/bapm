## ADDED Requirements

### Requirement: Typed executables deny_all and deny parse

The policy parser MUST accept an optional top-level `executables` mapping with boolean `deny_all` and list `deny` (package ids or patterns). Parsed values MUST be available on the policy model for merge and trust evaluation. Fields beyond this claim floor (`recommend`, `enforce`, `require`, and other nested unknowns under `executables`) MUST NOT crash parse; they MAY be ignored or warned. Unknown top-level keys outside the known set MUST continue to produce pl-009 warnings without failing parse.

#### Scenario: deny_all and deny parse

- **WHEN** policy YAML includes `executables: { deny_all: false, deny: [org/blocked] }`
- **THEN** parse MUST succeed and expose `deny_all` false and deny list containing `org/blocked`

#### Scenario: deny_all true parses

- **WHEN** policy YAML includes `executables: { deny_all: true }`
- **THEN** parse MUST succeed and expose `deny_all` true

#### Scenario: Unknown top-level still pl-009

- **WHEN** policy contains an unknown top-level key alongside a valid `executables` block
- **THEN** parse MUST succeed and MUST emit at least one pl-009 unknown-key warning for the unknown top-level key
