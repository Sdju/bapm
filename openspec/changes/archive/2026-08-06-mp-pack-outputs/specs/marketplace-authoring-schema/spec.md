## MODIFIED Requirements

### Requirement: Load marketplace authoring config from bapm.yml

The system MUST load a marketplace authoring configuration from the top-level `marketplace:` mapping in project `bapm.yml`. Unknown keys inside the `marketplace:` block MUST fail closed. When the block omits `name`, `description`, or `version`, the loader MUST inherit those fields from the top-level project manifest when present. The loader MUST parse and retain `owner`, `build` (including `tagPattern` / equivalent), and an `outputs` map (including a default Claude-oriented entry when present in templates) for pack emit and forward compatibility. Load, init, and package editor operations MUST NOT write Claude/Codex / `.claude-plugin/` / `.agents/plugins/` marketplace.json artifacts as a side effect; host JSON emission is the responsibility of pack marketplace outputs when selected.

#### Scenario: Load block with inherited project name

- **WHEN** `bapm.yml` has top-level `name: acme` and a `marketplace:` block without its own `name`
- **THEN** the loaded authoring config MUST expose name `acme` (or equivalent inherited identity) and MUST succeed validation of known keys

#### Scenario: Unknown key in marketplace block fails

- **WHEN** `marketplace:` contains a key outside the allowed authoring key set
- **THEN** loading MUST fail closed with a clear validation error

#### Scenario: outputs and build stored without emit on load

- **WHEN** a valid block includes `build.tagPattern` and `outputs.claude` (or equivalent outputs map)
- **THEN** the loaded config MUST retain those fields and MUST NOT create host marketplace.json files on disk as a side effect of load
