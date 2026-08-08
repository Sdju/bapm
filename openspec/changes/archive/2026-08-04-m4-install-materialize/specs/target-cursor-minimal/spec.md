## Purpose

Defines the minimal `bapm-target-cursor` package at `packages/target-cursor`: first host implementation that materializes skills into registered Cursor-related deploy roots for M4 e2e, depending only on `bapm-target-api`.

## ADDED Requirements

### Requirement: Package bapm-target-cursor exists and depends only on target-api

The monorepo MUST include package directory `packages/target-cursor` with package name `bapm-target-cursor`. The package MUST be TypeScript ESM with vite-plus tooling. Among bapm packages it MUST depend on `bapm-target-api` for types/contracts and MUST NOT require `@bapm/core` as a hard dependency for materialize logic.

#### Scenario: Package identity and dependency edge

- **WHEN** inspecting `bapm-target-cursor` package dependencies after implementation
- **THEN** it MUST depend on `bapm-target-api` and MUST NOT reverse-depend on `@bapm/core` for its host materialize implementation

### Requirement: Minimal detect and skills materialize under registered roots

The cursor target MUST provide a documented detection predicate (for example presence of `.cursor/` or an equivalent documented rule) and MUST materialize skills into its registered deploy root(s) only. When skills are deployed, paths MUST follow OpenAPM tg-003 preference for `.agents/skills/<name>/SKILL.md` unless the package documents a cursor-native registered root opt-out. Writes MUST NEVER escape registered roots (tg-002).

#### Scenario: Cursor e2e skills under registered root

- **WHEN** install runs with the cursor target registered and a dependency that provides a skill
- **THEN** the skill MUST appear under a registered deploy root (prefer `.agents/skills/<name>/SKILL.md` if tg-003 is claimed) and MUST NOT be written outside those roots

### Requirement: Not imported by core

`@bapm/core` MUST NOT hard-depend on or statically import `bapm-target-cursor`. Registration for CLI/e2e MAY occur in the CLI or test harness via the target-api registry.

#### Scenario: Core package graph excludes cursor

- **WHEN** inspecting `@bapm/core` dependencies
- **THEN** `bapm-target-cursor` MUST NOT appear as a dependency
