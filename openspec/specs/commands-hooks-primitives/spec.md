# commands-hooks-primitives Specification

## Purpose

Defines shared OpenAPM-aligned semantics for first-class `command` and `hook` primitives in bapm: source layouts, naming, conflict participation, and install-time expectations shared by discovery and host materialize.

## Requirements

### Requirement: Commands are sourced from prompt markdown

bapm MUST treat slash-command primitives as sourced from prompt markdown files. Canonical discovery path is `.apm/prompts/*.prompt.md`. Package-root `*.prompt.md` files MUST also be discovered for APM backward compatibility. There MUST NOT be a separate required `.apm/commands/` source directory for APM-layout packages. Each discovered unit MUST use primitive type `command`. The command name MUST be the base filename without the `.prompt.md` suffix (or an equivalent documented stem rule). Command primitives MUST participate in the same source attribution and conflict resolution as other primitives (local overrides dependency; first-declared dependency wins among dependencies).

#### Scenario: Canonical prompts become commands

- **WHEN** a package or project contains `.apm/prompts/review-pr.prompt.md`
- **THEN** discovery MUST yield a `command` primitive named `review-pr` with correct source attribution

#### Scenario: Root prompt markdown is discovered

- **WHEN** a package root contains `review-pr.prompt.md` and no colliding canonical entry wins under conflict rules
- **THEN** discovery MUST yield a `command` primitive for that file

### Requirement: Hooks are sourced from typed JSON layouts

bapm MUST discover hook primitives from `.apm/hooks/*.json` and from top-level `hooks/*.json` under a package or project root. Hook-only packages (top-level `hooks/*.json` without requiring other primitives) MUST be discoverable. Each discovered unit MUST use primitive type `hook`. The hook name MUST be derived from the JSON filename stem. Hook primitives MUST participate in the same source attribution and conflict resolution as other primitives.

#### Scenario: Typed .apm hooks discovered

- **WHEN** a package contains `.apm/hooks/pre-tool.json`
- **THEN** discovery MUST yield a `hook` primitive named `pre-tool` attributed to that package or local project

#### Scenario: Top-level hooks directory discovered

- **WHEN** a package contains top-level `hooks/post-merge.json`
- **THEN** discovery MUST yield a `hook` primitive for that file

### Requirement: Hosts apply target matrix for commands and hooks

After conflict resolution, install materialize MUST pass `command` and `hook` primitives to active host integrations. Cursor MUST deploy both commands and hooks under registered roots per `integration-cursor-runtime`. OpenCode MUST deploy commands and MUST NOT deploy hooks, emitting an inspectable skip for hooks per `integration-opencode-runtime`. Undeployed skips MUST NOT erase successful deployment of other primitive types in the same install when the host documents skip as non-fatal for that type.

#### Scenario: Conflict-resolved set reaches hosts

- **WHEN** install runs with conflict-resolved command and hook primitives and an active supported host
- **THEN** the host materialize path MUST receive those primitives and apply the host’s commands/hooks matrix rather than silently dropping them without a documented skip

### Requirement: Deployed commands and hooks enter lock inventory

When a host writes command or hook harness files during materialize, those paths MUST be reported in the materialize report so core can record them in lock `deployed_files` / `deployed_file_hashes` (and related inventory) like other primitives. Orphan cleanup MUST be able to remove previously recorded command/hook deploy paths when their owning dependency is removed.

#### Scenario: Command file is inventoried

- **WHEN** Cursor materialize writes `.cursor/commands/foo.md` for a dependency command
- **THEN** the materialize report MUST include that path for lock inventory association

#### Scenario: Removed dependency orphans hook deploy paths

- **WHEN** a dependency that previously deployed hook-owned paths is uninstalled or pruned and inventory records those paths
- **THEN** orphan cleanup MUST be able to remove those recorded paths according to existing inventory rules
