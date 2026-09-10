## ADDED Requirements

### Requirement: Portable Agent Plugins use native registration not loose materialize

When Copilot is an active install target and a dependency package is admitted to native Agent Plugins 1.0 registration, `@b-apm/integration-copilot` materialize MUST NOT write loose skill directories under `.agents/skills/` or otherwise project that package’s portable `skills/` / root `mcp.json` as decomposed Copilot primitives for that package. Non-plugin packages and non-admitted roots keep existing Copilot materialize behavior (instructions, prompts, agents, hooks, ordinary skills).

#### Scenario: Admitted plugin skips Copilot skill copy

- **WHEN** Copilot materialize would otherwise deploy a portable Agent Plugin skill from an admitted native-registered package
- **THEN** no loose `.agents/skills/<name>/` tree MUST be written for that skill from that package for Copilot

#### Scenario: Ordinary non-plugin skill still materializes

- **WHEN** Copilot materialize runs for a dependency that is not an admitted portable Agent Plugin root
- **THEN** skill primitives MUST still materialize under `.agents/skills/` per existing Copilot skill rules
