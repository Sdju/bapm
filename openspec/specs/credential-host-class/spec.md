# credential-host-class Specification

## Purpose

Defines the shared OpenAPM §10.3 credential host-class used for credential reuse and resolution: Public Suffix List eTLD+1 unioned with explicit `registries.*.aliases`, operator overlap precedence selecting exactly one effective class, and non-default port narrowing within a class — without collapsing classes via CNAME, TLS SAN, or shared redirects.

## Requirements

### Requirement: Credential host-class is PSL eTLD+1 or explicit aliases
Two hostnames MUST be treated as the same credential host-class for credential reuse if and only if (a) they share the same eTLD+1 per the Public Suffix List, or (b) an explicit `registries.<name>.aliases` entry binds an alias hostname into the credential class of that registry entry’s `url` host. The system MUST NOT collapse credential classes based on CNAME records, TLS SAN overlap, or shared HTTP redirects. Operator configuration signals that assign a provider class under the overlap requirement are exempt from treating that assignment as a PSL violation.

#### Scenario: Same eTLD+1 shares class
- **WHEN** two hostnames share the same Public Suffix List eTLD+1 (for example `api.github.com` and `github.com`)
- **THEN** credential host-class comparison MUST treat them as the same class for reuse

#### Scenario: Distinct eTLD+1 does not share class
- **WHEN** two hostnames have different Public Suffix List eTLD+1 values and no aliases bind them
- **THEN** credential host-class comparison MUST treat them as different classes

#### Scenario: Alias binds into registry url class
- **WHEN** a registry entry’s `url` host is `pkgs.example.com` and `aliases` includes `mirror.example.net`
- **THEN** `mirror.example.net` MUST share the credential host-class of `pkgs.example.com` for credential reuse

#### Scenario: Redirect observation does not collapse class
- **WHEN** a request to host A receives a redirect whose Location is host B with a different credential host-class
- **THEN** A and B MUST remain distinct credential classes for reuse decisions

### Requirement: Resolve credentials per host class without cross-class forward
Credentials MUST be resolved and attached per the selected credential host-class (and provider-class selection where operator signals apply). The system MUST NOT forward or attach credentials belonging to class A on a request whose destination is class B. Diagnostics that name credential provenance MUST use a source identifier (for example an env var name) and MUST NOT emit the secret literal.

#### Scenario: Class A token unused for class B request
- **WHEN** only a class-A credential is available in the environment and the request destination is class B
- **THEN** resolve MUST NOT attach the class-A credential to the class-B request

#### Scenario: Diagnostic names source id not secret
- **WHEN** a credential is resolved for a host class
- **THEN** diagnostics MAY name the source id and MUST NOT include the secret value

### Requirement: Operator overlap selects one class with documented precedence
Operator configuration signals that bind a hostname to a provider/credential class MUST yield exactly one effective class before credential resolve. When multiple signals overlap for the same FQDN, precedence MUST be deterministic and documented: when both ADO host allowlist signals (`ADO_HOST` / `APM_ADO_HOSTS`) and `GITHUB_HOST` claim the same hostname, **ado** MUST win; when `GITHUB_HOST` (GHES) and GitLab allowlist signals claim the same hostname, classification MUST fail closed. Config-signal assignments under this requirement remain exempt from the PSL-only reuse prohibition.

#### Scenario: ADO wins over GITHUB_HOST on same FQDN
- **WHEN** the same hostname is listed in ADO host allowlist signals and equals `GITHUB_HOST`
- **THEN** the effective class before resolve MUST be ado and GitHub-class tokens MUST NOT be selected for attach

#### Scenario: GHES and GitLab overlap fails closed
- **WHEN** the same hostname is both `GITHUB_HOST` and listed in GitLab allowlist signals
- **THEN** classification MUST fail closed before credential resolve

### Requirement: Non-default port stays in credential scope within class
An explicit non-default port on a request URL MUST remain part of transport identity and credential lookup scope within the credential host-class. The port MUST narrow the lookup within the class and MUST NOT invent a new Public Suffix List class by itself.

#### Scenario: Port narrows cache key within class
- **WHEN** credentials are resolved for `host.example` on port `8443` and separately for the default HTTPS port on the same host
- **THEN** the two lookups MUST be distinct within the same credential host-class
