## MODIFIED Requirements

### Requirement: Optional MCP configure contract for targets

If install orchestrates MCP config through `bapm-target-api`, the api package MUST provide a documented optional configure surface (method on target, capability flag, or equivalent) sufficient for passing server definitions and receiving a report of the configuration path written by that target. A successful configure report MUST identify a non-empty project-relative configuration path. Targets that do not implement MCP configure MUST be skippable without failing non-MCP install. Core MUST speak only through the api package.

#### Scenario: Missing MCP capability skips without hard fail

- **WHEN** a registered mock target lacks MCP configure and install has no MCP deps
- **THEN** install MUST complete modules/lock without requiring MCP configure

#### Scenario: Core does not import cursor for MCP

- **WHEN** core triggers MCP configure for a registered target
- **THEN** it MUST do so only via `bapm-target-api` contracts/registration

#### Scenario: Configure report identifies the target configuration path

- **WHEN** a registered target successfully configures eligible MCP servers
- **THEN** its configure report MUST identify the non-empty project-relative path it wrote
