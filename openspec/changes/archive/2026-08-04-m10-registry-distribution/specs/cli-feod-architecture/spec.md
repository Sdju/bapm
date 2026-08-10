## ADDED Requirements

### Requirement: M10 registry CLI wiring follows FEOD thin-command pattern

`publish` and `self-update` MUST use thin handlers under `src/commands/` that delegate to directory module(s) under `src/modules/` with `index.ts` public API (names flexible, e.g. `Publish`, `SelfUpdate`). Domain logic MUST live in `@b-apm/core` (or CLI modules only as thin adapters). Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@b-apm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Publish command uses module API

- **WHEN** the user invokes `publish`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call a Publish module public API wired through app init/integrations

#### Scenario: Self-update command uses module API

- **WHEN** the user invokes `self-update --check`
- **THEN** orchestration MUST be reached via a SelfUpdate (or equivalently named) module public API, not inlined in `app/registry.ts` or the command file
