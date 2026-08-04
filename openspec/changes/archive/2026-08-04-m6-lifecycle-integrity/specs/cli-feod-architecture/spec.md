## ADDED Requirements

### Requirement: Lifecycle CLI modules follow FEOD thin-command pattern
Each M6 lifecycle/integrity command (`update`, `outdated`, `uninstall`, `prune`, `deps`, `audit`, `doctor`) MUST have a thin handler under `src/commands/` that delegates to a directory module under `src/modules/<Name>/` with `index.ts` public API. Domain logic MUST NOT live in `commands/` or `app/` beyond argv/exit mapping and soft IoC wiring. Module-local `commands/` folders and private `commands/_name/` MUST NOT be used. Single-file modules MUST NOT be used.

#### Scenario: Update command delegates to module API
- **WHEN** the user invokes the `update` command through the CLI runtime
- **THEN** the `commands` handler MUST NOT contain update domain logic beyond argv parsing and exit-code mapping, and MUST call the Update module public API (or equivalently named lifecycle module)

#### Scenario: Audit command uses module not app business logic
- **WHEN** the user invokes `audit --ci`
- **THEN** CI gate orchestration MUST be reached via a module public API wired through `app/init` / integrations, not inlined in `app/registry.ts` or the command file
