## Purpose

Thin package-registry HTTP client for APM de-facto `/v1/packages/{owner}/{repo}` wire: list versions, download archives, and publish PUT—with auth, caps, and fail-closed diagnostics—injectable for mock-registry acceptance tests without shipping a registry host.

## ADDED Requirements

### Requirement: List package versions over HTTP
The system MUST provide a registry HTTP client that issues `GET /v1/packages/{owner}/{repo}/versions` against a configured registry base URL and MUST parse a JSON body containing a `versions` array of objects with at least `version` and `digest` (and MAY include `published_at`). Non-JSON bodies, decode failures, and responses exceeding a documented JSON hard cap (~10 MiB spirit) MUST fail closed.

#### Scenario: List returns version and digest
- **WHEN** a mock registry returns `{ versions: [{ version: "1.0.0", digest: "sha256:…" }] }` for a package id
- **THEN** the client MUST expose that version and digest to callers without treating the response as success if JSON is invalid

#### Scenario: Oversized or non-JSON list fails closed
- **WHEN** the list endpoint returns non-JSON or a body beyond the documented cap
- **THEN** the client MUST fail closed with a clear diagnostic and MUST NOT invent empty version lists

### Requirement: Download package archive over HTTP
The client MUST support `GET /v1/packages/{owner}/{repo}/versions/{version}/download` returning zip (or gzip) bytes. Transport errors and HTTP 4xx/5xx MUST fail closed with actionable diagnostics. The client MUST expose the downloaded bytes (or a stream/handle) to the resolve/install path for hash verification before extract.

#### Scenario: Download returns archive bytes
- **WHEN** a mock registry serves a zip for a known owner/repo/version
- **THEN** the client MUST return those bytes (or equivalent readable content) to the caller

#### Scenario: Download 404 fails closed
- **WHEN** the download endpoint returns HTTP 404
- **THEN** the client MUST fail closed with a diagnostic naming the package coordinates

### Requirement: Publish package archive via PUT
The client MUST support `PUT /v1/packages/{owner}/{repo}/versions/{version}` with `Content-Type: application/zip` (or documented equivalent) body. HTTP 409 MUST be surfaced as immutability (version already published); 422 as validation failure; 401/403 as auth failure with remediation naming the token env. Success responses (2xx) MUST be distinguishable from conflict.

#### Scenario: PUT uploads zip
- **WHEN** the client PUTs a valid zip to a mock registry that accepts the version
- **THEN** the call MUST succeed with a 2xx outcome

#### Scenario: PUT 409 surfaces immutability
- **WHEN** the registry returns HTTP 409 for an existing version
- **THEN** the client/caller MUST fail with a non-success outcome that indicates immutability / bump version

### Requirement: Bearer auth from environment with anonymous GET fallback
When a registry token is configured via the documented env naming scheme (`BAPM_REGISTRY_TOKEN` and/or per-registry `…_TOKEN` documented in help/design), the client MUST send `Authorization: Bearer <token>`. When no token is configured, anonymous GET (list/download) MUST still be attempted. Missing auth on publish MUST fail with clear 401/403 remediation rather than silent success.

#### Scenario: Anonymous list without token
- **WHEN** no registry token env is set and the mock allows anonymous GET
- **THEN** list/download MUST proceed without an Authorization header

#### Scenario: 401 names token remediation
- **WHEN** a protected endpoint returns 401 or 403
- **THEN** the diagnostic MUST name the expected token environment variable(s) for remediation

### Requirement: HTTP client is injectable for tests
The registry HTTP transport MUST be injectable (port/adapter) so acceptance and unit tests can substitute a mock HTTP registry without binding production code to a live host. Production default MUST use real HTTP(S) against configured base URLs.

#### Scenario: Mock transport used in tests
- **WHEN** resolve/install/publish tests inject a mock registry transport
- **THEN** no outbound network to a real public registry MUST be required for those tests to pass
