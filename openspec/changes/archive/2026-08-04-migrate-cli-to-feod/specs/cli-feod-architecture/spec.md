## Purpose

Defines the FEOD layer layout and import boundaries for the `bapm` CLI package so commands, modules, and integrations stay separated under the locked project profile.

## ADDED Requirements

### Requirement: FEOD layer directories exist under src

The `packages/cli` package MUST organize source code under `src/` into the locked FEOD layers: `app`, `commands`, `modules`, `common`, and `globals` (the last MAY be empty until ambient types are needed).

#### Scenario: Layer roots are present after migration

- **WHEN** the FEOD migration of `packages/cli` is complete
- **THEN** `src/app`, `src/commands`, `src/modules`, and `src/common` directories MUST exist under `packages/cli`

### Requirement: Path alias maps @ to src

The TypeScript configuration for `packages/cli` MUST resolve the path alias `@/*` to `./src/*` so cross-level imports use `@/` rather than deep relative paths across layers.

#### Scenario: Alias resolves a cross-level import

- **WHEN** a file under `src/commands` imports a module public API via `@/modules/<Name>`
- **THEN** the TypeScript project MUST resolve that import through the `@/*` path mapping to `src/*`

### Requirement: Commands are thin handlers registered in app

Each CLI command MUST be implemented as a thin handler under `src/commands/` that parses argv and delegates to module public APIs. Command registration MUST be manual in `app` (registry). Module-local command folders and private command modules MUST NOT be used.

#### Scenario: Install command delegates to module API

- **WHEN** the user invokes the `install` command through the CLI runtime
- **THEN** the `commands` handler MUST NOT contain install domain/stub logic beyond argv parsing and exit-code mapping, and MUST call the Install module public API

#### Scenario: Help and version are command handlers

- **WHEN** the user invokes `help` or `version` (or equivalent flags)
- **THEN** dispatch MUST route through thin handlers under `src/commands/` registered by the app registry

### Requirement: Modules expose public API only via index

Each feature module under `src/modules/` MUST be a directory with an `index.ts` public entry. Deep imports into module internals from outside that module MUST NOT be used. Single-file modules MUST NOT be used.

#### Scenario: External code imports Install only via public entry

- **WHEN** app or commands code needs Install behavior
- **THEN** it MUST import from `@/modules/Install` (the module `index.ts`) and MUST NOT import files under `modules/Install/` internals

### Requirement: Common has no barrel index

The `common` layer MUST NOT contain any `index.ts` / barrel file. Consumers MUST import concrete files under `common/` (for example `@/common/constants/commands`).

#### Scenario: Common utility imported by path

- **WHEN** a module or command needs a shared constant or utility from `common`
- **THEN** the import path MUST target a concrete file under `src/common/`, not a `common` barrel

### Requirement: External @b-apm/core access goes through app integrations

Code in `commands/` MUST NOT import `@b-apm/core` directly. Access to `@b-apm/core` for CLI adapters MUST be mediated by `app/integrations` (and soft IoC wiring in `app/init` where dependencies are injected into modules).

#### Scenario: Install stub uses core via integrations

- **WHEN** the Install module needs manifest/lock file names or other core constants for the stub message
- **THEN** those values MUST be supplied through app integrations / init wiring rather than a direct `@b-apm/core` import inside `commands/`
