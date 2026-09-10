## ADDED Requirements

### Requirement: Uninstall and prune retire owned Copilot native registration

When uninstall or prune removes packages that were admitted to Copilot native Agent Plugin registration, the lifecycle operation MUST rebuild or patch the owned catalog and ownership ledger so removed plugins disappear, MUST retire corresponding `enabledPlugins["<name>@apm"]` keys owned by this registration, and MUST remove the generated catalog/ledger artifacts once no admitted plugins remain. Unrelated settings keys and enable keys with a non-`@apm` marketplace suffix MUST be preserved. Dry-run MUST NOT mutate registration files or settings.

#### Scenario: Uninstall removes plugin enable key and catalog row

- **WHEN** a natively registered portable plugin dependency is uninstalled from the project
- **THEN** its catalog row and `enabledPlugins["<name>@apm"]` entry MUST be removed (or omitted from the rebuilt projection) while unrelated settings keys remain

#### Scenario: Empty registration deletes generated catalog

- **WHEN** prune or uninstall leaves no admitted natively registered plugins
- **THEN** the generated `apm_modules/.github/plugin/marketplace.json` catalog (and empty owned ledger artifacts as applicable) MUST be removed rather than left listing stale plugins

#### Scenario: Dry-run lifecycle leaves registration untouched

- **WHEN** `uninstall --dry-run` or `prune --dry-run` would retire registration for a removed plugin
- **THEN** catalog, ledger, and `.github/copilot/settings.local.json` MUST remain unchanged
