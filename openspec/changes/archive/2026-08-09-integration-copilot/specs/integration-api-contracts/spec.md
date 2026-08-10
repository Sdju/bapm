## ADDED Requirements

### Requirement: Optional MCP env mode on integrations

`@b-apm/integration-api` MUST allow a `BapmIntegration` to optionally declare an MCP env handling mode distinguishing install-time bake from host runtime translate (for example `mcpEnvMode: "bake" | "translate"`). Absence of the field MUST mean bake-compatible behavior for install orchestration (preserving today’s Cursor default). The field MUST remain host-agnostic (no Copilot-specific types) so core can dispatch bake vs pass-through without importing concrete integration packages or hardcoding host ids.

#### Scenario: Translate mode is readable through the api contract

- **WHEN** a registered integration declares translate MCP env mode
- **THEN** consumers using only `@b-apm/integration-api` MUST be able to observe that mode without importing the concrete host package

#### Scenario: Missing mode defaults to bake-compatible install behavior

- **WHEN** a registered integration omits the MCP env mode field
- **THEN** install orchestration MUST treat it as bake-compatible (existing Cursor path)

## MODIFIED Requirements

### Requirement: Optional MCP configure contract for integrations

If install orchestrates MCP config through `@b-apm/integration-api`, the api package MUST provide a documented optional configure surface (method on integration, capability flag, or equivalent) sufficient for passing server definitions and receiving a report of the configuration path written by that integration. A successful configure report MUST identify a non-empty configuration path: ordinarily a project-/cwd-relative path for project-scoped MCP hosts, or an absolute path / home-tilde form when the integration documents home-scoped MCP configuration. Integrations that do not implement MCP configure MUST be skippable without failing non-MCP install. Core MUST speak only through the api package.

#### Scenario: Missing MCP capability skips without hard fail

- **WHEN** a registered mock integration lacks MCP configure and install has no MCP deps
- **THEN** install MUST complete modules/lock without requiring MCP configure

#### Scenario: Core does not import cursor for MCP

- **WHEN** core triggers MCP configure for a registered integration
- **THEN** it MUST do so only via `@b-apm/integration-api` contracts/registration

#### Scenario: Configure report identifies the integration configuration path

- **WHEN** a registered integration successfully configures eligible MCP servers
- **THEN** its configure report MUST identify the non-empty path it wrote (project-relative, absolute, or documented home-tilde form)

#### Scenario: Home-scoped MCP path is acceptable on the report

- **WHEN** a registered integration successfully configures MCP into a user-home config file
- **THEN** the configure report MUST still provide a non-empty `configPath` identifying that home config without requiring a project-relative path
