## ADDED Requirements

### Requirement: Marketplace host signals align with shared credential host-class
Marketplace host classification and thin env token resolve MUST remain fail-closed on GHES↔GitLab overlap and MUST NOT attach cross-provider tokens. In addition, marketplace classify MUST honor ADO host allowlist signals (`ADO_HOST` / `APM_ADO_HOSTS`) for on-prem ado parity, and when ADO allowlist and `GITHUB_HOST` claim the same FQDN, ado MUST win before token resolve. Marketplace credential attach paths MUST consult the shared credential-host-class / Auth resolve helpers so PSL eTLD+1 and registry aliases govern credential reuse — marketplace provider kind alone MUST NOT be treated as the OpenAPM sc-005 credential host-class.

#### Scenario: ADO_HOST allowlist classifies ado
- **WHEN** `ADO_HOST` or `APM_ADO_HOSTS` lists `ado.corp.example` and the marketplace source host is `ado.corp.example`
- **THEN** classification MUST treat the host as ado-class for token selection

#### Scenario: ADO wins over GITHUB_HOST for marketplace resolve
- **WHEN** the same hostname is in ADO allowlist and equals `GITHUB_HOST`
- **THEN** marketplace token resolve MUST select ado-class credentials and MUST NOT attach GitHub-class tokens

#### Scenario: Kind enum alone is not credential host-class
- **WHEN** two hosts share a marketplace provider kind but differ in Public Suffix List eTLD+1 and have no aliases binding them
- **THEN** credential reuse decisions MUST treat them as different credential host-classes
