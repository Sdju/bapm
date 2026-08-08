## ADDED Requirements

### Requirement: Local provider remains dual-read within ordered list

The `local` discovery provider MUST continue to apply dual-read branding (`apm-policy.yml` | `bapm-policy.yml`), explicit-path override, dual-conflict, neither-absent, and no parent walk exactly as before. It MUST participate as one named entry in the ordered provider list rather than being the sole discovery mechanism.

#### Scenario: Local dual-read still applies

- **WHEN** only `bapm-policy.yml` exists at project root and the `local` provider is invoked
- **THEN** discovery MUST resolve that path

## MODIFIED Requirements

### Requirement: Ordered providers local-only for M8

Discovery MUST be modeled as an ordered list of selectable providers (pl-001/011). The registered default provider list MUST include the `local` dual-read provider and the OpenAPM-named remote provider `github-owner-dotgithub` in a documented implementation-defined order. The default order MUST appear in the published conformance statement. Additional APM-only cascades (ADO, `.apm`/`_apm` multi-candidate) MUST NOT be required.

#### Scenario: Default provider list includes local and remote

- **WHEN** documenting or querying the default discovery provider order after P4
- **THEN** the list MUST include `local` and `github-owner-dotgithub` and MUST document that order in the conformance statement

#### Scenario: Local-only selection still possible

- **WHEN** a project selects only the `local` provider via `discovery:`
- **THEN** discovery MUST NOT invoke `github-owner-dotgithub`
