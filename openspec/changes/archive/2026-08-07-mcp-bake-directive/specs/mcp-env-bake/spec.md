## ADDED Requirements

### Requirement: Bapm `{bake:NAME}` directive forces install-time bake

In MCP `env` and `headers` string values, the system MUST treat `{bake:NAME}` and `{bake:env:NAME}` as **bapm-only** bake directives (not OpenAPM/APM syntax). `NAME` MUST be a non-empty identifier matching `[A-Za-z_][A-Za-z0-9_]*`. At bake time the system MUST replace each such token with the non-empty value of `NAME` from overrides (if provided) then the process environment, using the same fail-closed policy as other bake placeholders (diagnostic names `NAME`, never the secret). APM forms `${VAR}`, `${env:VAR}`, and legacy `<VAR>` MUST remain supported unchanged by this requirement.

#### Scenario: {bake:NAME} bakes from process env

- **WHEN** an MCP env value contains `{bake:API_TOKEN}` and `API_TOKEN` is set to a non-empty value in the process environment
- **THEN** the baked string MUST contain that literal value and MUST NOT retain the `{bake:API_TOKEN}` token

#### Scenario: {bake:env:NAME} bakes equivalently

- **WHEN** an MCP env value contains `{bake:env:MY_TOKEN}` and `MY_TOKEN` is set non-empty in the environment
- **THEN** the baked string MUST contain the literal `MY_TOKEN` value

#### Scenario: Unresolved {bake:NAME} fails closed

- **WHEN** an MCP env value contains `{bake:MISSING}` and neither overrides nor the environment supply a non-empty `MISSING`
- **THEN** bake MUST fail and MUST NOT write the unresolved `{bake:MISSING}` token into Cursor MCP config as a successful deploy

#### Scenario: APM placeholders still bake on Cursor

- **WHEN** an MCP env value uses `${API_TOKEN}` (APM form) with `API_TOKEN` set
- **THEN** Cursor install bake MUST still resolve it to a literal as before this directive
