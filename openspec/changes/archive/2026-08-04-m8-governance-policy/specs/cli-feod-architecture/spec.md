## ADDED Requirements

### Requirement: Policy CLI wiring follows FEOD thin-command pattern

Policy-related CLI behavior (install/lock/update flag passthrough, and optional `policy status`) MUST use thin handlers under `src/commands/` that delegate to directory module(s) under `src/modules/` with `index.ts` public API. Domain parse/evaluate logic MUST live in `@bapm/core` (or CLI modules only as thin adapters). Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@bapm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Install policy flags delegate via module

- **WHEN** the user invokes `install --policy` or `install --no-policy`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call Install (or Policy) module public API wired through app init/integrations

#### Scenario: Optional policy command uses module API

- **WHEN** `policy status` is registered
- **THEN** orchestration MUST be reached via a module public API, not inlined in `app/registry.ts` or the command file
