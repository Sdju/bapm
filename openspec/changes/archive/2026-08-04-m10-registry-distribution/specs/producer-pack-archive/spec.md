## ADDED Requirements

### Requirement: Pack remains distinct from registry publish flat zip

M7 plain pack archive semantics MUST remain unchanged as the producer pack product. Registry publish builds a separate **flat** APM-wire zip (see `producer-publish`). Pack MAY share low-level zip create/extract helpers with publish but MUST NOT be rewritten into the registry publish layout or require registry HTTP.

#### Scenario: Pack archive mode still produces M7 plain zip

- **WHEN** `pack --archive` runs on a conforming project after M10
- **THEN** the artifact MUST follow M7 plain-zip producer-pack rules and MUST NOT require a registry PUT

#### Scenario: Publish does not replace pack command

- **WHEN** both `pack` and `publish` are available
- **THEN** each MUST remain independently invocable with its own flag surface
