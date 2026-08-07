# target-api-contracts Specification

## Purpose

Defines the `bapm-integration-api` package at `packages/integration-api`: shared TypeScript contracts and registration utilities that form the only boundary between `@bapm/core` and concrete host target packages.

## Requirements

### Requirement: Package bapm-integration-api exists with vite-plus TypeScript toolchain

The monorepo MUST include package directory `packages/integration-api` with package name `bapm-integration-api`. The package MUST be TypeScript ESM and MUST use vite-plus scripts/tooling consistent with `packages/core` and `packages/cli`.

#### Scenario: Package identity and toolchain

- **WHEN** inspecting the workspace after this change is implemented
- **THEN** `packages/integration-api` MUST exist with name `bapm-integration-api` and MUST expose vite-plus build/test/check scripts as applicable

### Requirement: Contracts for target id, deploy roots, register, and materialize

`bapm-integration-api` MUST provide TypeScript contracts and utilities sufficient for: target identifier, detection predicate hook, declared deploy root(s), registration into a registry usable by core, and a `materialize(primitives, ctx)` (or equivalent) entry that target packages implement.

#### Scenario: Register target exposes id and roots

- **WHEN** a test double implementing the API is registered
- **THEN** consumers MUST be able to list the target id and its deploy roots through the API surface

#### Scenario: Materialize contract is invokable

- **WHEN** core (or a test harness) invokes materialize on a registered target with an attributed primitive set
- **THEN** the target implementation MUST receive that set through the shared contract without core importing the concrete package internals

### Requirement: Boundary-only dependency for core

`@bapm/core` MUST depend on `bapm-integration-api` for speaking to targets and MUST NOT import concrete `bapm-target-*` package internals through this boundary.

#### Scenario: Core speaks only through api package

- **WHEN** `@bapm/core` needs to describe or invoke target materialization
- **THEN** it MUST do so via `bapm-integration-api` contracts/registration only

### Requirement: Materialize may report deployed paths

`bapm-integration-api` MUST allow a target `materialize` implementation to report the list of project-relative (or cwd-relative) file paths it wrote (and optionally content hashes) so core install can record lock inventory for orphan cleanup and frozen re-verify. The report MAY be a return value, an out-parameter on context, or an equivalent documented contract extension. Core MUST consume this report only through the api package, never by importing concrete `bapm-target-*` internals.

#### Scenario: Materialize report is available to core via api

- **WHEN** a registered target materializes primitives and writes harness files
- **THEN** consumers using only `bapm-integration-api` MUST be able to obtain the set of deployed paths (and hashes when provided) without importing a concrete host package

### Requirement: No adapter catalog types in api

`bapm-integration-api` MUST NOT introduce a multi-host adapter catalog or Copilot/Claude/Gemini-specific contracts. Extensions MUST stay generic for any registered target id. The API MAY expose an optional host-agnostic MCP configure hook (or equivalent optional capability) that concrete targets may implement; Cursor implements it, and core MUST NOT require a second-host catalog to call it.

#### Scenario: Api stays without second-host catalog

- **WHEN** inspecting `bapm-integration-api` public types after this change
- **THEN** there MUST be no Copilot/Claude/Gemini adapter catalog types required for M9

#### Scenario: Optional MCP configure remains host-agnostic

- **WHEN** an optional MCP configure contract exists on the api package
- **THEN** it MUST be invokable through registration without core importing `bapm-integration-cursor` internals

### Requirement: Optional MCP configure contract for targets

If install orchestrates MCP config through `bapm-integration-api`, the api package MUST provide a documented optional configure surface (method on target, capability flag, or equivalent) sufficient for passing server definitions and receiving a report of the configuration path written by that target. A successful configure report MUST identify a non-empty project-relative configuration path. Targets that do not implement MCP configure MUST be skippable without failing non-MCP install. Core MUST speak only through the api package.

#### Scenario: Missing MCP capability skips without hard fail

- **WHEN** a registered mock target lacks MCP configure and install has no MCP deps
- **THEN** install MUST complete modules/lock without requiring MCP configure

#### Scenario: Core does not import cursor for MCP

- **WHEN** core triggers MCP configure for a registered target
- **THEN** it MUST do so only via `bapm-integration-api` contracts/registration

#### Scenario: Configure report identifies the target configuration path

- **WHEN** a registered target successfully configures eligible MCP servers
- **THEN** its configure report MUST identify the non-empty project-relative path it wrote

### Requirement: Target contracts stay free of dry-run

`bapm-integration-api` contracts for `materialize`, optional MCP configure, detection, and registration MUST NOT add a `dryRun` (or equivalent) parameter or require targets to branch on dry-run. Dry-run zero-write behavior MUST be enforced only by core/CLI orchestration (skipping write ports or substituting a core-boundary no-op), never by teaching concrete targets about dry-run.

#### Scenario: Public target types omit dryRun

- **WHEN** inspecting public `bapm-integration-api` TypeScript contracts for materialize and configureMcp contexts
- **THEN** those contracts MUST NOT require or expose a dry-run flag for target implementers

#### Scenario: Cursor target unchanged for dry-run

- **WHEN** dry-run install is executed with cursor registered
- **THEN** `bapm-integration-cursor` MUST NOT need dry-run-specific code paths; write ports simply MUST NOT be invoked (or MUST be wrapped only outside the target package)

### Requirement: Registry resolves an unambiguous detected target

`bapm-integration-api` MUST provide a registry operation that evaluates registered target detection for a project cwd and returns the detected registered targets. Detection failures from one target MUST be represented as diagnostics or a documented non-match, without activating that target. Consumers MUST be able to select a target by registered id without importing concrete target packages.

#### Scenario: Registry reports detected registered target

- **WHEN** a registry contains registered targets whose detection hooks are evaluated for a project cwd
- **THEN** consumers using only `bapm-integration-api` MUST be able to identify every positively detected target id and select a registered target by id

### Requirement: Target contract supplies compile emission capability

`bapm-integration-api` MUST define an optional host-agnostic compile emission capability through which a registered target receives the conflict-resolved primitive set and compile context, and reports the project-relative output path it would write or wrote. The compile context MUST preserve core-controlled validate and dry-run no-write semantics without requiring a concrete target to import core. A target without this capability MUST not be selected for compile.

#### Scenario: Registered compile-capable target receives primitives

- **WHEN** core invokes compile for a selected registered target that implements the compile emission capability
- **THEN** the target MUST receive the conflict-resolved primitives and MUST report its project-relative compile output path through the shared API contract

#### Scenario: Target without compile capability is not usable for compile

- **WHEN** a selected registered target lacks the compile emission capability
- **THEN** compile MUST fail with a clear capability error and MUST NOT fall back to a hard-coded host layout

### Requirement: Deployment reports retain target-owned attribution

Materialize and optional MCP configure reports exposed by `bapm-integration-api` MUST identify the registered target responsible for each reported deployment inventory entry, including project-relative paths and available hashes. The contract MUST allow core to associate returned deployment entries with the primitive or MCP inventory supplied to that target, without core deriving a concrete target's layout or filenames.

#### Scenario: Core records target-reported deployment inventory

- **WHEN** a registered target materializes primitives or configures MCP and returns deployment inventory
- **THEN** core MUST be able to record the reported target-owned paths and hashes using only `bapm-integration-api` contracts
