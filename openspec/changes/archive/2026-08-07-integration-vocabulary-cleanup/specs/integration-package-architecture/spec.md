## ADDED Requirements

### Requirement: Canonical integration architecture is the only active architecture authority

`integration-package-architecture` MUST be the sole active architecture specification for the integration boundary. Its requirements MUST retain the enduring constraints that host-specific behavior lives in `@b-apm/integration-*` packages, `@b-apm/integration-api` is the core-to-integration boundary, and core does not import concrete integrations. The retired `target-package-architecture` specification MUST not remain active.

#### Scenario: Maintainer consults active architecture guidance

- **WHEN** a maintainer consults active OpenSpec architecture guidance for a host capability
- **THEN** the canonical integration architecture specification defines the package boundary without requiring a superseded target-package architecture specification
