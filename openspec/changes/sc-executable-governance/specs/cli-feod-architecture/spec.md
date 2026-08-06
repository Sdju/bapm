## MODIFIED Requirements

### Requirement: M9 extras CLI wiring follows FEOD thin-command pattern
`compile`, `cache` (info/clean), install MCP/trust flag passthrough, and `approve` / `deny` MUST use thin handlers under `src/commands/` that delegate to directory module(s) under `src/modules/` with `index.ts` public API. Domain logic MUST live in `@bapm/core` (or CLI modules only as thin adapters). Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used. Access to `@bapm/core` MUST go through `app/integrations` / `app/init`, not direct imports from `commands/`.

#### Scenario: Compile command uses module API
- **WHEN** the user invokes `compile`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call a Compile module public API wired through app init/integrations

#### Scenario: Cache command uses module API
- **WHEN** the user invokes `cache info` or `cache clean`
- **THEN** orchestration MUST be reached via a Cache module public API, not inlined in `app/registry.ts` or the command file

#### Scenario: Approve command uses module API
- **WHEN** the user invokes `approve`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call an Approve module public API wired through app init/integrations

#### Scenario: Deny command uses module API
- **WHEN** the user invokes `deny`
- **THEN** the command handler MUST only parse flags/map exit codes and MUST call a Deny module public API wired through app init/integrations
