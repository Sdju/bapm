## ADDED Requirements

### Requirement: Marketplace authoring stays in existing FEOD Marketplace module

Authoring CLI verbs (`init`, `package`, `check`, optional `migrate`) MUST be implemented inside the existing `src/modules/Marketplace/` directory module and thin `src/commands/marketplace.ts` handler — not as a new top-level command module and not via module-local `commands/` folders. Public exports MUST remain through `modules/Marketplace/index.ts`. Domain authoring logic in the CLI MUST stay thin (argv/orchestration); schema/load/edit/check helpers MUST live in `@b-apm/core` and be reached via `app/integrations` / soft IoC, not via direct `@b-apm/core` imports inside `commands/`.

#### Scenario: Authoring routed through Marketplace module API

- **WHEN** the user invokes `bapm marketplace init` (or `package` / `check`)
- **THEN** the thin `commands/marketplace` handler MUST delegate to the Marketplace module public API and MUST NOT embed authoring domain logic beyond argv/exit mapping

#### Scenario: No new top-level authoring command module

- **WHEN** inspecting `packages/cli/src/modules` after this change
- **THEN** there MUST NOT be a separate top-level module whose sole purpose is marketplace authoring alongside `Marketplace` (authoring remains under `Marketplace`)
