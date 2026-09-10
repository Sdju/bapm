## Purpose

Defines project-scope native registration of portable Agent Plugins 1.0 for the Copilot install target: owned catalog and ledger under the modules tree, merge of namespaced Copilot settings keys, live load without copy or `--plugin-dir`, fail-closed admission, and lifecycle retirement of owned registration artifacts.

## ADDED Requirements

### Requirement: Portable plugins register natively for Copilot

When Copilot is an effective install target and a resolved dependency is an admitted portable Agent Plugins 1.0 root (canonical root `plugin.json` within the portable Agent Plugins boundary), install MUST register that plugin natively while the package tree remains under the project modules directory `apm_modules/`. Registration MUST NOT copy the plugin into Copilot private state and MUST NOT require `--plugin-dir` or a second `copilot plugin install`.

#### Scenario: Install registers portable plugin under apm_modules

- **WHEN** `bapm install --target copilot` runs against a dependency that is a valid portable Agent Plugins 1.0 root materialized under `apm_modules/`
- **THEN** the package MUST remain under `apm_modules/` and Copilot-facing registration MUST point at that live directory without copying the plugin tree into Copilot private install state

### Requirement: Owned catalog and ledger are generated under modules

For project-scope native registration, bapm MUST write (and rebuild on successful install) two generated artifacts it fully owns:

- `apm_modules/.github/plugin/marketplace.json` — catalog listing every admitted registered Agent Plugin with a path to its real package directory under `apm_modules/`
- `apm_modules/.github/plugin/apm-registration.json` — ownership ledger for the Copilot settings keys this registration manages

bapm MUST NOT treat a user-authored marketplace file as these generated artifacts and MUST NOT edit an author-owned marketplace path as part of this registration.

#### Scenario: Catalog lists installed portable plugin

- **WHEN** install admits one portable plugin named `my-plugin` for Copilot native registration
- **THEN** `apm_modules/.github/plugin/marketplace.json` MUST list that plugin pointing at its materialized directory and `apm_modules/.github/plugin/apm-registration.json` MUST exist as the ownership ledger

### Requirement: Settings merge uses namespaced marketplace and enable keys

Project-scope registration MUST merge into `.github/copilot/settings.local.json` (creating parents as needed) two namespaced concerns, preserving unrelated JSON keys and values semantically:

- `extraKnownMarketplaces.apm` with a directory source whose path is the repository-relative modules root `apm_modules`
- `enabledPlugins["<pluginName>@apm"]` set true for each admitted registered plugin name

Stable serialization MAY reformat the settings document. Invalid existing JSON (including JSONC comments) MUST fail closed without overwriting the original file. The marketplace path MUST stay repository-relative so registration survives clones and worktrees.

#### Scenario: Settings gain apm marketplace and enabled plugin keys

- **WHEN** install registers portable plugin `my-plugin` for Copilot
- **THEN** `.github/copilot/settings.local.json` MUST contain `extraKnownMarketplaces.apm` pointing at directory `apm_modules` and `enabledPlugins["my-plugin@apm"]` equal to true, and unrelated pre-existing keys MUST remain

#### Scenario: Invalid settings JSON fails closed

- **WHEN** `.github/copilot/settings.local.json` exists but is not valid plain JSON
- **THEN** install MUST fail non-zero with an explicit diagnostic and MUST NOT overwrite the original settings file

### Requirement: Marketplace ownership collision fails closed

Install MUST fail closed when a pre-existing `extraKnownMarketplaces.apm` entry points somewhere other than the modules materialization root and the ownership ledger does not record bapm/APM-compatible ownership of that marketplace entry. An entry that already matches what registration would write MUST be re-adopted silently (ledger regenerated as needed). Once the `apm` marketplace is owned, registration MUST set required `@apm` enable keys and MUST retire leftover `*@apm` enable keys that are no longer admitted, while preserving enable keys with a different marketplace suffix.

#### Scenario: Conflicting apm marketplace path is refused

- **WHEN** settings already define `extraKnownMarketplaces.apm` with a directory path other than `apm_modules` and the ledger does not record ownership of that entry
- **THEN** install MUST fail closed without overwriting that marketplace entry

#### Scenario: Matching marketplace is re-adopted

- **WHEN** settings already define `extraKnownMarketplaces.apm` with directory path `apm_modules` and the ledger is missing
- **THEN** install MUST re-adopt the entry, regenerate the ledger, and continue registration

### Requirement: No loose Copilot primitive projection for admitted plugins

For packages admitted to Copilot native registration, install MUST NOT decompose that plugin’s `skills/` or root `mcp.json` into loose Copilot harness primitives (`.agents/skills/`, home MCP configure entries sourced from that portable root) for the Copilot target. Non-plugin packages and non-Copilot targets keep existing materialize behavior.

#### Scenario: Portable skill is not double-deployed on Copilot

- **WHEN** Copilot is an effective target and an admitted portable plugin contains `skills/hello/SKILL.md`
- **THEN** install MUST register the plugin natively and MUST NOT also materialize `hello` as a loose skill under `.agents/skills/` for Copilot from that plugin root

### Requirement: Non-portable Agent Plugin admission fails closed

When a dependency is selected for the Copilot native Agent Plugin registration path but is not a valid portable Agent Plugins 1.0 root (missing or invalid portable `plugin.json` contract for this boundary), install MUST fail closed before completing lock commit for that mutating run. Install MUST NOT silently fall back to copying the tree into Copilot private state or to a `--plugin-dir`-style workflow.

#### Scenario: Invalid portable root aborts registration

- **WHEN** Copilot is an effective target and a dependency presents a non-portable or invalid Agent Plugin root that cannot be admitted
- **THEN** install MUST fail closed with a diagnostic and MUST NOT claim successful native registration for that package

### Requirement: Plugin name collisions are deterministic

Only plugins that pass target and security/integrity admission participate in registration and name-collision handling. If two admitted dependencies declare the same plugin name, a direct dependency MUST win over a transitive dependency. Two admitted claimants at the same precedence MUST fail with an actionable collision instead of registering either one. An admitted transitive dependency MUST NOT silently replace the owner recorded in the ownership ledger.

#### Scenario: Same-precedence name collision fails

- **WHEN** two admitted direct dependencies both declare portable plugin name `dup`
- **THEN** install MUST fail closed with a collision diagnostic and MUST NOT register either claimant under that name

#### Scenario: Direct wins over transitive

- **WHEN** a direct dependency and a transitive dependency both declare portable plugin name `shared`
- **THEN** registration MUST keep the direct dependency’s plugin and MUST NOT let the transitive claimant replace the ledger owner

### Requirement: Copilot binary is not required at install time

Native registration MUST NOT locate, execute, or version-check a Copilot binary during install, update, restore, uninstall, or prune. Documentation MUST state that live loading of the generated projection requires GitHub Copilot CLI 1.0.81 or newer.

#### Scenario: Registration succeeds without Copilot on PATH

- **WHEN** install registers an admitted portable plugin for Copilot and no Copilot CLI binary is available
- **THEN** registration MUST still complete for the projection files and settings merge without invoking Copilot
