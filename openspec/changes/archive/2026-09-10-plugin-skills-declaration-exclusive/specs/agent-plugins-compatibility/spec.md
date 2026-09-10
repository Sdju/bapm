## ADDED Requirements

### Requirement: Declared plugin skills are exclusive when present

When a portable Agent Plugins `plugin.json` declares top-level `skills`, bapm MUST treat that declaration as the exclusive skill deploy set for the plugin (requirements, not hints), per `plugin-skills-declaration`. Omitting `skills` MUST keep conventional immediate `skills/<name>/SKILL.md` discovery. An explicit empty list MUST deploy zero skills. Invalid declared entries MUST fail closed before deploy/lock commit. The field MUST NOT be ignored as an unknown manifest key.

#### Scenario: Present skills key is not an unknown field

- **WHEN** a valid portable `plugin.json` includes a well-typed `skills` array
- **THEN** load MUST retain the declaration without an unknown-field warning for `skills`, and discovery MUST apply exclusive semantics

#### Scenario: Compatibility matrix remains skills-capable

- **WHEN** maintainers inspect the Agent Plugins compatibility status after this change
- **THEN** skills MUST remain a supported portable component, including exclusive declaration when the key is present

## MODIFIED Requirements

### Requirement: Portable v1 artifact boundary is explicit

bapm MUST treat portable Agent Plugins support as a boundary separate from `CONFORMANCE.md` and OpenAPM claims. The supported artifact components are a root `plugin.json`, skill units from conventional immediate `skills/<name>/SKILL.md` directories when `skills` is omitted (including contained auxiliary files) or from exclusive `plugin.json` `skills` declarations when present, and root `mcp.json` servers using `stdio`, `streamable-http`, or `sse`. `plugin.json` MUST NOT be treated as a bapm/OpenAPM manifest or marketplace publication contract.

#### Scenario: Compatibility status stays outside OpenAPM claims

- **WHEN** maintainers inspect the Agent Plugins compatibility status artifact
- **THEN** it covers portable `plugin.json` / skills / MCP mapping without encoding an OpenAPM or marketplace publication claim

#### Scenario: Exclusive skills stay inside the portable boundary

- **WHEN** a portable plugin declares `"skills": ["hello"]` with a valid conventional-depth skill directory
- **THEN** that skill remains an in-boundary portable component subject to exclusive declaration rules rather than an unsupported extension
