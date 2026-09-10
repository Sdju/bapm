## ADDED Requirements

### Requirement: Install runs Copilot native Agent Plugin registration

When the effective install target set includes `copilot`, after dependencies are materialized under `apm_modules/`, install MUST run project-scope native Agent Plugin registration for admitted portable Agent Plugins 1.0 per `copilot-native-agent-plugins` (catalog, ledger, settings merge). Dry-run MUST NOT write catalog, ledger, or settings. Registration failures that are fail-closed (invalid portable admission, settings JSON, marketplace ownership collision, same-precedence name collision) MUST abort before claiming a successful mutating install/lock commit for that run.

#### Scenario: Copilot target triggers native registration

- **WHEN** `bapm install --target copilot` successfully admits at least one portable Agent Plugin dependency
- **THEN** install MUST write/update the owned catalog and ledger under `apm_modules/.github/plugin/` and merge namespaced keys into `.github/copilot/settings.local.json`

#### Scenario: Dry-run skips registration writes

- **WHEN** `bapm install --target copilot --dry-run` would admit a portable plugin
- **THEN** catalog, ledger, and `.github/copilot/settings.local.json` MUST remain unchanged

#### Scenario: Registration fail-closed aborts lock commit

- **WHEN** native registration fails closed (for example invalid settings JSON or marketplace ownership collision)
- **THEN** install MUST exit non-zero and MUST NOT present the run as a successful lock-committing install

### Requirement: Install skips loose Copilot projection for native-registered plugins

When Copilot is an effective target, install MUST NOT materialize loose Copilot skills or Copilot-targeted MCP configure entries from a package root that was admitted to native Agent Plugin registration. Other targets in the same install MAY still receive their normal portable projections for that package unless those targets define their own native whole-plugin path.

#### Scenario: Cursor still receives portable skills while Copilot registers natively

- **WHEN** install runs with effective targets including both `copilot` and `cursor` against one admitted portable plugin
- **THEN** Copilot MUST use native registration without loose `.agents/skills/` projection from that plugin for Copilot, and Cursor MAY still materialize portable skills/MCP per existing Cursor rules
