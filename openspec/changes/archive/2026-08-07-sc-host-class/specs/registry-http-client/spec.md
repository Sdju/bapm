## ADDED Requirements

### Requirement: Authed registry requests use redirect Auth drop

When the Registry HTTP client issues Authed requests (Authorization Bearer present), the production transport MUST follow redirects using the redirect-auth-drop capability: on cross-credential-host-class 3xx, origin Authorization and origin-class credential material MUST be dropped before the redirected request; destination-class credentials MAY be re-resolved. Default native fetch redirect following that forwards Authorization across credential host classes MUST NOT be used for Authed production Registry traffic.

#### Scenario: Authed list/download drops Auth on cross-class redirect

- **WHEN** an Authed Registry list or download request receives a 3xx Location on a different credential host-class
- **THEN** the redirected request MUST NOT carry the origin Bearer token

#### Scenario: Anonymous GET still allowed without token

- **WHEN** no registry token is configured
- **THEN** list/download MUST still proceed without Authorization and MUST NOT invent a Bearer header
