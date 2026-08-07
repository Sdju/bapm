# redirect-auth-drop Specification

## Purpose

Defines Authed consumer HTTP redirect handling so origin-class Authorization and other origin-class credential material are dropped when a 3xx Location targets a different credential host-class, satisfying OpenAPM sc-003 redirect Auth drop without relying on marketplace no-Auth fetches alone.

## Requirements

### Requirement: Cross-class redirect drops origin Authorization
When an Authed consumer HTTP client receives an HTTP 3xx response whose Location host credential class differs from the originating request’s credential class, the client MUST drop the originating Authorization header and any other origin-class credential material before issuing the redirected request. The client MAY re-resolve credentials for the destination class. Same-class redirects MAY retain destination-appropriate credentials. Authed clients MUST NOT rely on default browser-like redirect following that silently forwards origin Authorization across host classes.

#### Scenario: Cross-class 3xx strips Authorization
- **WHEN** an Authed GET to host class A receives `302` with Location on host class B and the origin request carried Authorization
- **THEN** the follow-up request to B MUST NOT include the origin Authorization value

#### Scenario: Same-class redirect may keep auth path
- **WHEN** an Authed GET to host class A receives `302` with Location still in host class A
- **THEN** the client MAY attach credentials appropriate to class A on the redirected request

#### Scenario: Destination class may re-resolve
- **WHEN** a cross-class redirect occurs and credentials exist for the destination class
- **THEN** the client MAY attach destination-class credentials after dropping origin-class material

### Requirement: Authed Registry transport uses redirect-safe follow
The production Registry HTTP transport used for Authed list/download/publish MUST perform redirect handling that satisfies the cross-class Authorization drop requirement (manual redirect mode or equivalent). Injectable mock transports used only in tests MAY simulate final responses without real redirects, but production default MUST NOT silently forward Bearer tokens across credential host classes.

#### Scenario: Production Authed registry fetch is redirect-safe
- **WHEN** the default Registry HTTP transport performs an Authed request that receives a cross-class 3xx
- **THEN** the redirected request MUST NOT carry the origin Bearer token
