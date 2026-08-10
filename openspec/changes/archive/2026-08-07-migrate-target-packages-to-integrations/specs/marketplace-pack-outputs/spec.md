## ADDED Requirements

### Requirement: Claude and Codex marketplace outputs have explicit integration owners

Claude marketplace output MUST be provided by `@b-apm/integration-claude`, and Codex marketplace output MUST be provided by `@b-apm/integration-codex`. These packages MAY be marketplace-output-only integrations. Each MUST own its host-specific JSON mapping, default path, validation, and output metadata; `@b-apm/core` MUST provide only generic resolution, selection, atomic-write orchestration, and integration capability invocation.

#### Scenario: Claude output is selected

- **WHEN** pack selects Claude marketplace output
- **THEN** the Claude integration supplies the Claude-shaped document and default path through the generic integration capability contract

#### Scenario: Codex output is selected

- **WHEN** pack selects Codex marketplace output
- **THEN** the Codex integration supplies the Codex-shaped document, category validation, and default path through the generic integration capability contract

### Requirement: Marketplace outputs do not require runtime integration capabilities

Marketplace-output integrations MUST be selectable independently of runtime detection, deploy, MCP, and compile capabilities. A project that emits only marketplace artifacts MUST NOT require a Cursor or other runtime integration to be installed or registered.

#### Scenario: Pack uses a marketplace-only integration

- **WHEN** pack runs with only Codex marketplace output enabled
- **THEN** it succeeds by selecting the Codex integration output capability without activating a runtime target
