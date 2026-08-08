## ADDED Requirements

### Requirement: Producer CLI modules follow FEOD thin-command pattern

Each M7 producer command (`init`, `pack`) MUST have a thin handler under `src/commands/` that delegates to a directory module under `src/modules/<Name>/` with `index.ts` public API. Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@bapm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Init command delegates to module API

- **WHEN** the user invokes the `init` command through the CLI runtime
- **THEN** the `commands` handler MUST NOT contain init domain logic beyond argv parsing and exit-code mapping, and MUST call the Init module public API

#### Scenario: Pack command uses module not app business logic

- **WHEN** the user invokes `pack --archive` or `pack --check-release`
- **THEN** pack/release-gate orchestration MUST be reached via a Pack module public API wired through `app/init` / integrations, not inlined in `app/registry.ts` or the command file
