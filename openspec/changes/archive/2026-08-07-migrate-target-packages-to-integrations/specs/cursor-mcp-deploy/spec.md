## ADDED Requirements

### Requirement: Cursor MCP deployment is an integration capability

Cursor MCP configuration MUST be provided by the registered `@b-apm/integration-cursor` MCP capability through `@b-apm/integration-api`. Install orchestration MUST remain host-neutral and MUST NOT use a legacy package import, alias, or Cursor-specific fallback outside the registered capability report.

#### Scenario: Cursor config is selected through integration registry

- **WHEN** install configures eligible MCP servers for an active Cursor project
- **THEN** it invokes the Cursor integration capability and records the project-relative configuration path reported by that capability
