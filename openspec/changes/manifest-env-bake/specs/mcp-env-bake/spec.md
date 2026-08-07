## ADDED Requirements

### Requirement: Top-level env mapping is validated

When the project manifest declares top-level `env`, it MUST be a mapping whose keys are non-empty strings matching env-var name shape `[A-Za-z_][A-Za-z0-9_]*` and whose values are strings (empty string allowed). Non-mapping `env` or invalid key/value shapes MUST fail validation. Absence of `env` MUST remain valid.

#### Scenario: Valid env map accepted

- **WHEN** the manifest includes `env: { API_TOKEN: "x", EMPTY: "" }`
- **THEN** parse/load MUST succeed and retain those entries on the document

#### Scenario: Invalid env rejected

- **WHEN** `env` is a list, or a key is `1BAD`, or a value is a nested mapping
- **THEN** validation MUST fail closed

## MODIFIED Requirements

### Requirement: Resolve MCP placeholder syntaxes at bake time

Before writing host MCP configuration for Cursor, the system MUST resolve placeholder tokens in string values of MCP `env` maps (and `headers` maps when present) using OpenAPM/APM-compatible syntaxes: `${VAR}`, `${env:VAR}`, and legacy `<VAR>` (uppercase name). Resolution MUST prefer an explicit override map when provided by the caller, then a non-empty value from the process environment, then a non-empty value from the project manifest top-level `env` map when present. Values that contain no placeholders MUST pass through unchanged. Single-brace `{name}` APM-internal template variables and `${input:…}` interactive inputs are OUT OF SCOPE for this capability unless a later change adds them.

#### Scenario: ${VAR} bakes from process env

- **WHEN** an eligible MCP server declares `env.API_TOKEN: "${API_TOKEN}"` and `API_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal environment value, not the placeholder string

#### Scenario: ${env:VAR} bakes equivalently

- **WHEN** an eligible MCP server declares `env.TOKEN: "${env:MY_TOKEN}"` and `MY_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal `MY_TOKEN` value

#### Scenario: Legacy angle placeholder bakes

- **WHEN** an eligible MCP server declares `env.TOKEN: "<MY_TOKEN>"` and `MY_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal `MY_TOKEN` value

#### Scenario: Manifest env fills when process env missing

- **WHEN** an eligible MCP server declares `env.TOKEN: "${PLUGIN_TOKEN}"`, process env has no non-empty `PLUGIN_TOKEN`, and the manifest has `env.PLUGIN_TOKEN: "from-yml"`
- **THEN** the baked server env MUST contain `from-yml`

#### Scenario: Process env wins over manifest env

- **WHEN** both process env and manifest `env` define non-empty `API_TOKEN` and bake resolves `${API_TOKEN}`
- **THEN** the baked value MUST be the process environment value

### Requirement: Fail closed when a placeholder cannot be resolved

When a bake-required placeholder appears in MCP `env` or `headers` and neither overrides, nor a non-empty process environment value, nor a non-empty manifest top-level `env` value supplies the variable, the system MUST fail the install/configure path with a non-zero outcome and an actionable diagnostic that names the missing variable (never the secret value). The system MUST NOT write unresolved secret placeholders into `.cursor/mcp.json` for those maps. Interactive TTY prompting for missing variables MUST NOT be required for success.

#### Scenario: Missing env var aborts before mcp.json write

- **WHEN** MCP env contains `${MISSING_SECRET}` and `MISSING_SECRET` is unset in process env, absent/empty in manifest `env`, and no override supplies it
- **THEN** configure/write of `.cursor/mcp.json` for that install MUST NOT complete successfully with the unresolved placeholder, and the diagnostic MUST name `MISSING_SECRET`

### Requirement: Bapm `{bake:NAME}` directive forces install-time bake

In MCP `env` and `headers` string values, the system MUST treat `{bake:NAME}` and `{bake:env:NAME}` as **bapm-only** bake directives (not OpenAPM/APM syntax). `NAME` MUST be a non-empty identifier matching `[A-Za-z_][A-Za-z0-9_]*`. At bake time the system MUST replace each such token with the non-empty value of `NAME` from overrides (if provided), then the process environment, then the project manifest top-level `env` map, using the same fail-closed policy as other bake placeholders (diagnostic names `NAME`, never the secret). APM forms `${VAR}`, `${env:VAR}`, and legacy `<VAR>` MUST remain supported unchanged by this requirement.

#### Scenario: {bake:NAME} bakes from process env

- **WHEN** an MCP env value contains `{bake:API_TOKEN}` and `API_TOKEN` is set to a non-empty value in the process environment
- **THEN** the baked string MUST contain that literal value and MUST NOT retain the `{bake:API_TOKEN}` token

#### Scenario: {bake:NAME} bakes from manifest env when process unset

- **WHEN** an MCP env value contains `{bake:PLUGIN_TOKEN}`, process env lacks non-empty `PLUGIN_TOKEN`, and manifest has `env.PLUGIN_TOKEN: "from-yml"`
- **THEN** the baked string MUST contain `from-yml`

#### Scenario: {bake:env:NAME} bakes equivalently

- **WHEN** an MCP env value contains `{bake:env:MY_TOKEN}` and `MY_TOKEN` is set non-empty in the environment
- **THEN** the baked string MUST contain the literal `MY_TOKEN` value

#### Scenario: Unresolved {bake:NAME} fails closed

- **WHEN** an MCP env value contains `{bake:MISSING}` and neither overrides, process env, nor manifest `env` supply a non-empty `MISSING`
- **THEN** bake MUST fail and MUST NOT write the unresolved `{bake:MISSING}` token into Cursor MCP config as a successful deploy

#### Scenario: APM placeholders still bake on Cursor

- **WHEN** an MCP env value uses `${API_TOKEN}` (APM form) with `API_TOKEN` set
- **THEN** Cursor install bake MUST still resolve it to a literal as before this directive
