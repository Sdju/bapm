## ADDED Requirements

### Requirement: Document manifest env as bapm bake extension

User-facing documentation MUST describe top-level `env:` as a bapm extension for supplying bake defaults / name wiring for MCP secret placeholders, state that non-empty process environment values win over manifest `env`, and warn that real secrets SHOULD live in the process environment (not committed YAML) when possible.

#### Scenario: Docs mention env and precedence

- **WHEN** a reader opens the manifest guide
- **THEN** they MUST find `env:` documented with bake use-case and process-env-wins precedence
