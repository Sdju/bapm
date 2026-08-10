## ADDED Requirements

### Requirement: Marketplace CLI module follows FEOD thin-command pattern

The `marketplace` command MUST have a thin handler under `src/commands/` that delegates to a directory module under `src/modules/Marketplace/` with `index.ts` public API. Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring via `app/init` and `app/integrations`. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Commands MUST obtain `@b-apm/core` marketplace APIs only through app integrations / injected deps, not via direct `@b-apm/core` imports inside `commands/`.

#### Scenario: Marketplace command delegates to module API

- **WHEN** the user invokes `bapm marketplace <subcommand>` through the CLI runtime
- **THEN** the `commands` handler MUST NOT contain marketplace domain logic beyond argv parsing and exit-code mapping, and MUST call the Marketplace module public API

#### Scenario: Marketplace module imported only via public entry

- **WHEN** app or commands code needs Marketplace CLI behavior
- **THEN** it MUST import from `@/modules/Marketplace` and MUST NOT deep-import module internals
