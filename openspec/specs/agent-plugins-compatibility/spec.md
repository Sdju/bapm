# agent-plugins-compatibility Specification

## Purpose

Defines bapm's bounded, testable support for portable Agent Plugins v1 artifacts without making an external certification, universal-client, OpenAPM, or marketplace conformance claim.

## Requirements

### Requirement: Portable v1 artifact boundary is explicit

bapm MUST document portable Agent Plugins support separately from `CONFORMANCE.md` and OpenAPM claims. The supported artifact components are a root `plugin.json`, immediate `skills/<name>/SKILL.md` directories (including contained auxiliary files), and root `mcp.json` servers using `stdio`, `streamable-http`, or `sse`. `plugin.json` MUST NOT be represented as a bapm/OpenAPM manifest or marketplace publication contract.

#### Scenario: Reader distinguishes portability from bapm artifacts

- **WHEN** a reader opens the Agent Plugins support documentation
- **THEN** it distinguishes `plugin.json` from `bapm.yml`/`apm.yml`, OpenAPM claims, and marketplace publication

### Requirement: Target MCP behavior is adapter-specific

Portable MCP entries MUST be treated as an input contract and adapted by targets rather than copied as a universal host configuration. The Cursor target MUST map portable `stdio` to Cursor `stdio`, `streamable-http` to Cursor `http`, and `sse` to Cursor `sse` in `.cursor/mcp.json`. The OpenCode target MUST map portable `stdio` to OpenCode `local` (`command` array) and portable `streamable-http` to OpenCode `remote` (`url`) under project `opencode.json` `mcp`; portable `sse` MUST NOT be silently remapped unless OpenCode documents an equivalent and the OpenCode integration implements it. No other target behavior is implied unless that target explicitly documents it.

#### Scenario: Cursor maps a portable HTTP server

- **WHEN** an installed portable plugin declares a `streamable-http` server and Cursor is active
- **THEN** Cursor writes an `http` server entry rather than copying portable metadata verbatim

#### Scenario: OpenCode maps a portable HTTP server

- **WHEN** an installed portable plugin declares a `streamable-http` server and OpenCode is active
- **THEN** OpenCode writes a `type: "remote"` entry under `opencode.json` `mcp` rather than copying portable metadata verbatim

### Requirement: Non-goals are not implicit support claims

Documentation MUST state that sandboxing, OAuth or secret injection, hooks, agents, commands, client extensions, vendor-specific extension behavior, and unsupported components are outside this boundary. Reserved or secret-like MCP environment entries and escaping skill paths MUST be rejected or withheld.

#### Scenario: Unsafe portable input is not deployed

- **WHEN** a portable MCP entry attempts to override plugin-owned environment or a skill path escapes the plugin root
- **THEN** the entry is not deployed and diagnostics explain the rejection

### Requirement: Compatibility status is fixture-enforced

The repository MUST maintain a dedicated Agent Plugins compatibility status artifact distinct from `CONFORMANCE.json`. Its generated output MUST be derived from cases that cite existing concrete fixtures and regression tests. A repository command MUST fail when generated output drifts or a cited fixture/test is absent.

#### Scenario: Compatibility artifact drifts

- **WHEN** a support case changes without regenerating the published Agent Plugins matrix
- **THEN** `agent-plugins:check` fails

### Requirement: End-to-end portable regression coverage

Regression coverage MUST exercise producer manifest creation, portable pack, safe extraction, consumer installation, complete skill directory materialization, and target MCP mapping. It MUST also retain unsafe-input rejection coverage. Coverage MUST include at least one path that installs a packed portable plugin into Cursor and one path that installs into OpenCode when `@bapm/integration-opencode` is the active host.

#### Scenario: Packed portable plugin installs into Cursor

- **WHEN** a portable producer with a skill directory and MCP server is packed, extracted, and installed into a Cursor project
- **THEN** the skill auxiliary files are materialized and the MCP server is adapted under `.cursor/mcp.json`

#### Scenario: Packed portable plugin installs into OpenCode

- **WHEN** a portable producer with a skill directory and MCP server is packed, extracted, and installed into an OpenCode project with `@bapm/integration-opencode` active
- **THEN** the skill auxiliary files are materialized under `.opencode/skills/` and the MCP server is adapted under project `opencode.json` `mcp`
