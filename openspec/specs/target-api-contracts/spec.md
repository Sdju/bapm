# target-api-contracts Specification

## Purpose

Defines the `bapm-target-api` package at `packages/target-api`: shared TypeScript contracts and registration utilities that form the only boundary between `@bapm/core` and concrete host target packages.

## Requirements

### Requirement: Package bapm-target-api exists with vite-plus TypeScript toolchain
The monorepo MUST include package directory `packages/target-api` with package name `bapm-target-api`. The package MUST be TypeScript ESM and MUST use vite-plus scripts/tooling consistent with `packages/core` and `packages/cli`.

#### Scenario: Package identity and toolchain
- **WHEN** inspecting the workspace after this change is implemented
- **THEN** `packages/target-api` MUST exist with name `bapm-target-api` and MUST expose vite-plus build/test/check scripts as applicable

### Requirement: Contracts for target id, deploy roots, register, and materialize
`bapm-target-api` MUST provide TypeScript contracts and utilities sufficient for: target identifier, detection predicate hook, declared deploy root(s), registration into a registry usable by core, and a `materialize(primitives, ctx)` (or equivalent) entry that target packages implement.

#### Scenario: Register target exposes id and roots
- **WHEN** a test double implementing the API is registered
- **THEN** consumers MUST be able to list the target id and its deploy roots through the API surface

#### Scenario: Materialize contract is invokable
- **WHEN** core (or a test harness) invokes materialize on a registered target with an attributed primitive set
- **THEN** the target implementation MUST receive that set through the shared contract without core importing the concrete package internals

### Requirement: Boundary-only dependency for core
`@bapm/core` MUST depend on `bapm-target-api` for speaking to targets and MUST NOT import concrete `bapm-target-*` package internals through this boundary.

#### Scenario: Core speaks only through api package
- **WHEN** `@bapm/core` needs to describe or invoke target materialization
- **THEN** it MUST do so via `bapm-target-api` contracts/registration only

### Requirement: Materialize may report deployed paths
`bapm-target-api` MUST allow a target `materialize` implementation to report the list of project-relative (or cwd-relative) file paths it wrote (and optionally content hashes) so core install can record lock inventory for orphan cleanup and frozen re-verify. The report MAY be a return value, an out-parameter on context, or an equivalent documented contract extension. Core MUST consume this report only through the api package, never by importing concrete `bapm-target-*` internals.

#### Scenario: Materialize report is available to core via api
- **WHEN** a registered target materializes primitives and writes harness files
- **THEN** consumers using only `bapm-target-api` MUST be able to obtain the set of deployed paths (and hashes when provided) without importing a concrete host package

### Requirement: No adapter catalog types in api
`bapm-target-api` MUST NOT introduce a multi-host adapter catalog or Copilot/Claude/Gemini-specific contracts. Extensions MUST stay generic for any registered target id. The API MAY expose an optional host-agnostic MCP configure hook (or equivalent optional capability) that concrete targets may implement; Cursor implements it, and core MUST NOT require a second-host catalog to call it.

#### Scenario: Api stays without second-host catalog
- **WHEN** inspecting `bapm-target-api` public types after this change
- **THEN** there MUST be no Copilot/Claude/Gemini adapter catalog types required for M9

#### Scenario: Optional MCP configure remains host-agnostic
- **WHEN** an optional MCP configure contract exists on the api package
- **THEN** it MUST be invokable through registration without core importing `bapm-target-cursor` internals

### Requirement: Optional MCP configure contract for targets
If install orchestrates MCP config through `bapm-target-api`, the api package MUST provide a documented optional configure surface (method on target, capability flag, or equivalent) sufficient for passing server definitions and receiving written path reports. Targets that do not implement MCP configure MUST be skippable without failing non-MCP install. Core MUST speak only through the api package.

#### Scenario: Missing MCP capability skips without hard fail
- **WHEN** a registered mock target lacks MCP configure and install has no MCP deps
- **THEN** install MUST complete modules/lock without requiring MCP configure

#### Scenario: Core does not import cursor for MCP
- **WHEN** core triggers MCP configure for a registered target
- **THEN** it MUST do so only via `bapm-target-api` contracts/registration
