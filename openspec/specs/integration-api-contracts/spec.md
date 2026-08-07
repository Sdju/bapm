# integration-api-contracts Specification

## Purpose

Defines the `bapm-integration-api` package at `packages/integration-api`: shared TypeScript contracts and registration utilities that form the only boundary between `@bapm/core` and concrete host integrations.

## Requirements

### Requirement: Package bapm-integration-api exists with vite-plus TypeScript toolchain

The monorepo MUST include package directory `packages/integration-api` with package name `bapm-integration-api`. The package MUST be TypeScript ESM and MUST use vite-plus scripts/tooling consistent with `packages/core` and `packages/cli`.

#### Scenario: Package identity and toolchain

- **WHEN** inspecting the workspace after this change is implemented
- **THEN** `packages/integration-api` MUST exist with name `bapm-integration-api` and MUST expose vite-plus build/test/check scripts as applicable

### Requirement: Public API uses integration-neutral registration vocabulary

`bapm-integration-api` MUST export `BapmIntegration`, `IntegrationRegistry`, and `createIntegrationRegistry` as its public integration registration vocabulary. The registry MUST preserve capability registration, listing, lookup, detection, and invocation behavior for integrations. The API MUST provide TypeScript contracts sufficient for: integration identifier, detection predicate hook, declared deploy root(s), registration into a registry usable by core, and a `materialize(primitives, ctx)` (or equivalent) entry that integrations implement.

#### Scenario: Consumer registers an integration with the renamed API

- **WHEN** a downstream consumer creates an integration registry, registers an integration, and retrieves it by id using only the renamed exports
- **THEN** registration and retrieval succeed with the same observable capability behavior as before the vocabulary cleanup

#### Scenario: Materialize contract is invokable

- **WHEN** core (or a test harness) invokes materialize on a registered integration with an attributed primitive set
- **THEN** the integration implementation MUST receive that set through the shared contract without core importing the concrete package internals

### Requirement: Legacy public API aliases are unavailable

`bapm-integration-api` MUST NOT resolve or export `BapmTarget`, `TargetRegistry`, `createTargetRegistry`, `createRegistry`, or another alias that preserves the retired target-era public registration API.

#### Scenario: Consumer imports a retired API name

- **WHEN** a downstream consumer attempts to import a retired target-era public registration export
- **THEN** module loading fails because the retired export is not provided

### Requirement: Target-domain selector remains supported

The integration API MUST continue to accept integration identifiers for selection so that core and CLI can preserve the OpenAPM target-domain manifest fields and `--target <id>` selector behavior.

#### Scenario: Explicit target selects registered integration

- **WHEN** an install or compile consumer supplies `--target cursor` for a registered Cursor integration
- **THEN** the Cursor integration is selected and invoked through the integration-neutral registry

### Requirement: Boundary-only dependency for core

`@bapm/core` MUST depend on `bapm-integration-api` for speaking to integrations and MUST NOT import concrete `bapm-integration-*` package internals through this boundary.

#### Scenario: Core speaks only through api package

- **WHEN** `@bapm/core` needs to describe or invoke a host capability
- **THEN** it MUST do so via `bapm-integration-api` contracts/registration only

### Requirement: Materialize may report deployed paths

`bapm-integration-api` MUST allow an integration `materialize` implementation to report the list of project-relative (or cwd-relative) file paths it wrote (and optionally content hashes) so core install can record lock inventory for orphan cleanup and frozen re-verify. The report MAY be a return value, an out-parameter on context, or an equivalent documented contract extension. Core MUST consume this report only through the api package, never by importing concrete integration internals.

#### Scenario: Materialize report is available to core via api

- **WHEN** a registered integration materializes primitives and writes harness files
- **THEN** consumers using only `bapm-integration-api` MUST be able to obtain the set of deployed paths (and hashes when provided) without importing a concrete host package

### Requirement: No adapter catalog types in api

`bapm-integration-api` MUST NOT introduce a multi-host adapter catalog or Copilot/Claude/Gemini-specific contracts. Extensions MUST stay generic for any registered integration id. The API MAY expose an optional host-agnostic MCP configure hook (or equivalent optional capability) that concrete integrations may implement; Cursor implements it, and core MUST NOT require a second-host catalog to call it.

#### Scenario: Api stays without second-host catalog

- **WHEN** inspecting `bapm-integration-api` public types after this change
- **THEN** there MUST be no Copilot/Claude/Gemini adapter catalog types required for M9

#### Scenario: Optional MCP configure remains host-agnostic

- **WHEN** an optional MCP configure contract exists on the api package
- **THEN** it MUST be invokable through registration without core importing `bapm-integration-cursor` internals

### Requirement: Optional MCP configure contract for integrations

If install orchestrates MCP config through `bapm-integration-api`, the api package MUST provide a documented optional configure surface (method on integration, capability flag, or equivalent) sufficient for passing server definitions and receiving a report of the configuration path written by that integration. A successful configure report MUST identify a non-empty project-relative configuration path. Integrations that do not implement MCP configure MUST be skippable without failing non-MCP install. Core MUST speak only through the api package.

#### Scenario: Missing MCP capability skips without hard fail

- **WHEN** a registered mock integration lacks MCP configure and install has no MCP deps
- **THEN** install MUST complete modules/lock without requiring MCP configure

#### Scenario: Core does not import cursor for MCP

- **WHEN** core triggers MCP configure for a registered integration
- **THEN** it MUST do so only via `bapm-integration-api` contracts/registration

#### Scenario: Configure report identifies the integration configuration path

- **WHEN** a registered integration successfully configures eligible MCP servers
- **THEN** its configure report MUST identify the non-empty project-relative path it wrote

### Requirement: Integration contracts stay free of dry-run

`bapm-integration-api` contracts for `materialize`, optional MCP configure, detection, and registration MUST NOT add a `dryRun` (or equivalent) parameter or require integrations to branch on dry-run. Dry-run zero-write behavior MUST be enforced only by core/CLI orchestration (skipping write ports or substituting a core-boundary no-op), never by teaching concrete integrations about dry-run.

#### Scenario: Public integration types omit dryRun

- **WHEN** inspecting public `bapm-integration-api` TypeScript contracts for materialize and configureMcp contexts
- **THEN** those contracts MUST NOT require or expose a dry-run flag for integration implementers

#### Scenario: Cursor integration unchanged for dry-run

- **WHEN** dry-run install is executed with cursor registered
- **THEN** `bapm-integration-cursor` MUST NOT need dry-run-specific code paths; write ports simply MUST NOT be invoked (or MUST be wrapped only outside the integration package)

### Requirement: Registry resolves an unambiguous detected integration

`bapm-integration-api` MUST provide a registry operation that evaluates registered integration detection for a project cwd and returns the detected registered integrations. Detection failures from one integration MUST be represented as diagnostics or a documented non-match, without activating that integration. Consumers MUST be able to select an integration by registered id without importing concrete integration packages.

#### Scenario: Registry reports detected registered integration

- **WHEN** a registry contains registered integrations whose detection hooks are evaluated for a project cwd
- **THEN** consumers using only `bapm-integration-api` MUST be able to identify every positively detected integration id and select a registered integration by id

### Requirement: Integration contract supplies compile emission capability

`bapm-integration-api` MUST define an optional host-agnostic compile emission capability through which a registered integration receives the conflict-resolved primitive set and compile context, and reports the project-relative output path it would write or wrote. The compile context MUST preserve core-controlled validate and dry-run no-write semantics without requiring a concrete integration to import core. An integration without this capability MUST not be selected for compile.

#### Scenario: Registered compile-capable integration receives primitives

- **WHEN** core invokes compile for a selected registered integration that implements the compile emission capability
- **THEN** the integration MUST receive the conflict-resolved primitives and MUST report its project-relative compile output path through the shared API contract

#### Scenario: Integration without compile capability is not usable for compile

- **WHEN** a selected registered integration lacks the compile emission capability
- **THEN** compile MUST fail with a clear capability error and MUST NOT fall back to a hard-coded host layout

### Requirement: Deployment reports retain integration-owned attribution

Materialize and optional MCP configure reports exposed by `bapm-integration-api` MUST identify the registered integration responsible for each reported deployment inventory entry, including project-relative paths and available hashes. The contract MUST allow core to associate returned deployment entries with the primitive or MCP inventory supplied to that integration, without core deriving a concrete integration's layout or filenames.

#### Scenario: Core records integration-reported deployment inventory

- **WHEN** a registered integration materializes primitives or configures MCP and returns deployment inventory
- **THEN** core MUST be able to record the reported integration-owned paths and hashes using only `bapm-integration-api` contracts

### Requirement: Integration API exposes generic optional capabilities

`bapm-integration-api` MUST expose capability contracts for runtime deployment, MCP configuration, compile emission, and marketplace-output emission without encoding a fixed host catalog. Capability discovery and invocation MUST permit an integration to implement any supported subset.

#### Scenario: Marketplace-only integration is usable

- **WHEN** a registered Claude or Codex integration exposes marketplace-output emission but no runtime deployment capability
- **THEN** core can select its marketplace output capability without inferring or requiring runtime behavior

### Requirement: Integration API has no legacy package compatibility surface

The public API and workspace resolution graph MUST NOT expose legacy target package names, legacy module specifiers, or deprecated aliases.

#### Scenario: Legacy import is rejected

- **WHEN** a consumer or workspace source attempts to resolve a retired target package specifier
- **THEN** resolution fails because no alias or compatibility package is provided
