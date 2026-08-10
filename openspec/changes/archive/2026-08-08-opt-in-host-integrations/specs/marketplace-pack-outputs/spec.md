## MODIFIED Requirements

### Requirement: Claude and Codex marketplace outputs have explicit integration owners

Claude marketplace output MUST be provided by `@b-apm/integration-claude`, and Codex marketplace output MUST be provided by `@b-apm/integration-codex`. These packages MAY be marketplace-output-only integrations. Each MUST own its host-specific JSON mapping, default path, validation, and output metadata; `@b-apm/core` MUST provide only generic resolution, selection, atomic-write orchestration, and integration capability invocation. The CLI composition root MUST NOT eagerly static-register Claude or Codex marketplace-output integrations at registry construction. When pack’s effective format selection includes Claude and/or Codex, the composition path MUST dynamically resolve and register the corresponding package for that run when it is resolvable; if the package cannot be resolved or does not expose marketplace-output capability, pack MUST fail closed with guidance to install the integration package.

#### Scenario: Claude output is selected

- **WHEN** pack selects Claude marketplace output and `@b-apm/integration-claude` resolves with marketplace-output capability
- **THEN** the Claude integration supplies the Claude-shaped document and default path through the generic integration capability contract

#### Scenario: Codex output is selected

- **WHEN** pack selects Codex marketplace output and `@b-apm/integration-codex` resolves with marketplace-output capability
- **THEN** the Codex integration supplies the Codex-shaped document, category validation, and default path through the generic integration capability contract

#### Scenario: Missing Claude package fails closed

- **WHEN** pack selects Claude marketplace output and `@b-apm/integration-claude` cannot be resolved
- **THEN** pack MUST exit non-zero with guidance to install the Claude integration package and MUST NOT write a Claude marketplace.json as if a built-in emitter existed

### Requirement: Marketplace outputs do not require runtime integration capabilities

Marketplace-output integrations MUST be selectable independently of runtime detection, deploy, MCP, and compile capabilities. A project that emits only marketplace artifacts MUST NOT require a Cursor or other runtime integration to be installed or registered. Selecting Claude/Codex marketplace emit MUST still require the corresponding marketplace-output integration package to be installed and loadable for that run (not eager CLI built-ins).

#### Scenario: Pack uses a marketplace-only integration

- **WHEN** pack runs with only Codex marketplace output enabled and `@b-apm/integration-codex` is resolvable
- **THEN** it succeeds by selecting the Codex integration output capability without activating a runtime target
