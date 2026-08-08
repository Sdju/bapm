## Purpose

Defines the integration-neutral public API through which consumers register and invoke host integrations without preserving target-era API aliases.

## ADDED Requirements

### Requirement: Public API uses integration-neutral registration vocabulary

`@bapm/integration-api` MUST export `BapmIntegration`, `IntegrationRegistry`, and `createIntegrationRegistry` as its public integration registration vocabulary. The registry MUST preserve the existing capability registration, listing, lookup, detection, and invocation behavior for integrations.

#### Scenario: Consumer registers an integration with the renamed API

- **WHEN** a downstream consumer creates an integration registry, registers an integration, and retrieves it by id using only the renamed exports
- **THEN** registration and retrieval succeed with the same observable capability behavior as before the vocabulary cleanup

### Requirement: Legacy public API aliases are unavailable

`@bapm/integration-api` MUST NOT resolve or export `BapmTarget`, `TargetRegistry`, `createTargetRegistry`, `createRegistry`, or another alias that preserves the retired target-era public registration API.

#### Scenario: Consumer imports a retired API name

- **WHEN** a downstream consumer attempts to import a retired target-era public registration export
- **THEN** module loading fails because the retired export is not provided

### Requirement: Target-domain selector remains supported

The integration API MUST continue to accept integration identifiers for selection so that core and CLI can preserve the OpenAPM target-domain manifest fields and `--target <id>` selector behavior.

#### Scenario: Explicit target selects registered integration

- **WHEN** an install or compile consumer supplies `--target cursor` for a registered Cursor integration
- **THEN** the Cursor integration is selected and invoked through the integration-neutral registry
