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
`bapm-target-api` MUST NOT introduce a multi-host adapter catalog, Copilot/Claude-specific contracts, or MCP client configure surface in this change. Extensions MUST stay generic for any registered target id.

#### Scenario: Api stays host-agnostic
- **WHEN** inspecting `bapm-target-api` public types after this change
- **THEN** there MUST be no second-host catalog or MCP-configure API required for M5 cursor polish
