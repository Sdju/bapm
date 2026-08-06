## ADDED Requirements

### Requirement: Pack module wires marketplace emit flags
Marketplace pack flags (`--marketplace`, `--marketplace-path`, marketplace-aware `--offline`) MUST be parsed and orchestrated inside the existing `src/modules/Pack/` directory module and thin `src/commands/pack.ts` handler — not via a new top-level command module and not by restoring a `marketplace build` verb. Domain resolve/map/write logic MUST live in `@bapm/core` and be reached via `app/integrations` / soft IoC, not via direct `@bapm/core` imports inside `commands/`. Pack module public API MUST remain the CLI entry for both plain-zip and marketplace emit orchestration.

#### Scenario: Pack marketplace flags go through Pack module
- **WHEN** the user invokes `bapm pack --archive --marketplace all` (or equivalent) on a project with authoring outputs
- **THEN** flag parsing and orchestration MUST be reached via the Pack module public API wired through `app/init` / integrations

#### Scenario: No marketplace build command module
- **WHEN** inspecting CLI command modules after this change
- **THEN** there MUST NOT be a registered `marketplace build` verb or a new top-level Build command module for host JSON emit
