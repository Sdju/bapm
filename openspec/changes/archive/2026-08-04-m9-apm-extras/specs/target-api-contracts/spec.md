## MODIFIED Requirements

### Requirement: No adapter catalog types in api

`bapm-target-api` MUST NOT introduce a multi-host adapter catalog or Copilot/Claude/Gemini-specific contracts. Extensions MUST stay generic for any registered target id. The API MAY expose an optional host-agnostic MCP configure hook (or equivalent optional capability) that concrete targets may implement; Cursor implements it, and core MUST NOT require a second-host catalog to call it.

#### Scenario: Api stays without second-host catalog

- **WHEN** inspecting `bapm-target-api` public types after this change
- **THEN** there MUST be no Copilot/Claude/Gemini adapter catalog types required for M9

#### Scenario: Optional MCP configure remains host-agnostic

- **WHEN** an optional MCP configure contract exists on the api package
- **THEN** it MUST be invokable through registration without core importing `bapm-target-cursor` internals

## ADDED Requirements

### Requirement: Optional MCP configure contract for targets

If install orchestrates MCP config through `bapm-target-api`, the api package MUST provide a documented optional configure surface (method on target, capability flag, or equivalent) sufficient for passing server definitions and receiving written path reports. Targets that do not implement MCP configure MUST be skippable without failing non-MCP install. Core MUST speak only through the api package.

#### Scenario: Missing MCP capability skips without hard fail

- **WHEN** a registered mock target lacks MCP configure and install has no MCP deps
- **THEN** install MUST complete modules/lock without requiring MCP configure

#### Scenario: Core does not import cursor for MCP

- **WHEN** core triggers MCP configure for a registered target
- **THEN** it MUST do so only via `bapm-target-api` contracts/registration
