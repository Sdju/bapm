# cli-feod-architecture Specification

## Purpose

Defines the FEOD layer layout and import boundaries for the `bapm` CLI package so commands, modules, and integrations stay separated under the locked project profile.

## Requirements

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

### Requirement: External @bapm/core access goes through app integrations
Code in `commands/` MUST NOT import `@bapm/core` directly. Access to `@bapm/core` for CLI adapters MUST be mediated by `app/integrations` (and soft IoC wiring in `app/init` where dependencies are injected into modules).

#### Scenario: Install stub uses core via integrations
- **WHEN** the Install module needs manifest/lock file names or other core constants for the stub message
- **THEN** those values MUST be supplied through app integrations / init wiring rather than a direct `@bapm/core` import inside `commands/`

### Requirement: Lifecycle CLI modules follow FEOD thin-command pattern
Each M6 lifecycle/integrity command (`update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`) MUST have a thin handler under `src/commands/` that delegates to a directory module under `src/modules/<Name>/` with `index.ts` public API. Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used.

#### Scenario: Update command delegates to module API
- **WHEN** the user invokes the `update` command through the CLI runtime
- **THEN** the `commands` handler MUST NOT contain update domain logic beyond argv parsing and exit-code mapping, and MUST call the Update module public API (or equivalently named lifecycle module)

#### Scenario: Audit command uses module not app business logic
- **WHEN** the user invokes `audit --ci`
- **THEN** CI gate orchestration MUST be reached via a module public API wired through `app/init` / integrations, not inlined in `app/registry.ts` or the command file

### Requirement: Producer CLI modules follow FEOD thin-command pattern
Each M7 producer command (`init`, `pack`) MUST have a thin handler under `src/commands/` that delegates to a directory module under `src/modules/<Name>/` with `index.ts` public API. Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@bapm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Init command delegates to module API
- **WHEN** the user invokes the `init` command through the CLI runtime
- **THEN** the `commands` handler MUST NOT contain init domain logic beyond argv parsing and exit-code mapping, and MUST call the Init module public API

#### Scenario: Pack command uses module not app business logic
- **WHEN** the user invokes `pack --archive` or `pack --check-release`
- **THEN** pack/release-gate orchestration MUST be reached via a Pack module public API wired through `app/init` / integrations, not inlined in `app/registry.ts` or the command file

### Requirement: Policy CLI wiring follows FEOD thin-command pattern
Policy-related CLI behavior (install/lock/update flag passthrough, and optional `policy status`) MUST use thin handlers under `src/commands/` that delegate to directory module(s) under `src/modules/` with `index.ts` public API. Domain parse/evaluate logic MUST live in `@bapm/core` (or CLI modules only as thin adapters). Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@bapm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Install policy flags delegate via module
- **WHEN** the user invokes `install --policy` or `install --no-policy`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call Install (or Policy) module public API wired through app init/integrations

#### Scenario: Optional policy command uses module API
- **WHEN** `policy status` is registered
- **THEN** orchestration MUST be reached via a module public API, not inlined in `app/registry.ts` or the command file

### Requirement: M9 extras CLI wiring follows FEOD thin-command pattern
`compile`, `cache` (info/clean), install MCP/trust flag passthrough, and optional SHOULD commands (`mcp`, `approve`, `deny`) MUST use thin handlers under `src/commands/` that delegate to directory module(s) under `src/modules/` with `index.ts` public API. Domain logic MUST live in `@bapm/core` (or CLI modules only as thin adapters). Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@bapm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Compile command uses module API
- **WHEN** the user invokes `compile`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call a Compile module public API wired through app init/integrations

#### Scenario: Cache command uses module API
- **WHEN** the user invokes `cache info` or `cache clean`
- **THEN** orchestration MUST be reached via a Cache module public API, not inlined in `app/registry.ts` or the command file

### Requirement: M10 registry CLI wiring follows FEOD thin-command pattern
`publish` and `self-update` MUST use thin handlers under `src/commands/` that delegate to directory module(s) under `src/modules/` with `index.ts` public API (names flexible, e.g. `Publish`, `SelfUpdate`). Domain logic MUST live in `@bapm/core` (or CLI modules only as thin adapters). Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@bapm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Publish command uses module API
- **WHEN** the user invokes `publish`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call a Publish module public API wired through app init/integrations

#### Scenario: Self-update command uses module API
- **WHEN** the user invokes `self-update --check`
- **THEN** orchestration MUST be reached via a SelfUpdate (or equivalently named) module public API, not inlined in `app/registry.ts` or the command file
