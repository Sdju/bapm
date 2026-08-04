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
