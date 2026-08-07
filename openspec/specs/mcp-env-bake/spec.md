# mcp-env-bake Specification

## Purpose

Install-time bake of OpenAPM/APM MCP env and header placeholders into literal values before Cursor MCP config is written, matching APM Cursor legacy resolution without runtime substitution.

## Requirements

### Requirement: Resolve MCP placeholder syntaxes at bake time

Before writing host MCP configuration for Cursor, the system MUST resolve placeholder tokens in string values of MCP `env` maps (and `headers` maps when present) using OpenAPM/APM-compatible syntaxes: `${VAR}`, `${env:VAR}`, and legacy `<VAR>` (uppercase name). Resolution MUST prefer an explicit override map when provided by the caller, then the process environment. Values that contain no placeholders MUST pass through unchanged. Single-brace `{name}` APM-internal template variables and `${input:…}` interactive inputs are OUT OF SCOPE for this capability unless a later change adds them.

#### Scenario: ${VAR} bakes from process env

- **WHEN** an eligible MCP server declares `env.API_TOKEN: "${API_TOKEN}"` and `API_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal environment value, not the placeholder string

#### Scenario: ${env:VAR} bakes equivalently

- **WHEN** an eligible MCP server declares `env.TOKEN: "${env:MY_TOKEN}"` and `MY_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal `MY_TOKEN` value

#### Scenario: Legacy angle placeholder bakes

- **WHEN** an eligible MCP server declares `env.TOKEN: "<MY_TOKEN>"` and `MY_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal `MY_TOKEN` value

### Requirement: Fail closed when a placeholder cannot be resolved

When a bake-required placeholder appears in MCP `env` or `headers` and neither overrides nor the process environment supplies a non-empty value, the system MUST fail the install/configure path with a non-zero outcome and an actionable diagnostic that names the missing variable (never the secret value). The system MUST NOT write unresolved secret placeholders into `.cursor/mcp.json` for those maps. Interactive TTY prompting for missing variables MUST NOT be required for success.

#### Scenario: Missing env var aborts before mcp.json write

- **WHEN** MCP env contains `${MISSING_SECRET}` and `MISSING_SECRET` is unset and no override supplies it
- **THEN** configure/write of `.cursor/mcp.json` for that install MUST NOT complete successfully with the unresolved placeholder, and the diagnostic MUST name `MISSING_SECRET`

### Requirement: No Cursor runtime translate-mode

For the Cursor host path, the system MUST use install-time bake only. It MUST NOT rewrite MCP env/header values into host runtime placeholders (for example leaving `${VAR}` for Cursor to expand later) as a substitute for bake.

#### Scenario: Baked config contains literals not runtime placeholders

- **WHEN** bake succeeds for `${API_TOKEN}` with a known env value
- **THEN** the written Cursor `mcpServers` entry env MUST store the literal value and MUST NOT store `${API_TOKEN}` as a runtime placeholder

### Requirement: Agent Plugins portable MCP path unchanged by this capability

Portable Agent Plugins `mcp.json` parsing (including `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` substitution and refusal of secret-like env keys) MUST remain a separate boundary. This bake capability MUST apply to consumer `dependencies.mcp` (and equivalent collected MCP server configs for Cursor deploy), not redefine Agent Plugins secret policy.

#### Scenario: Agent Plugins secret refuse still applies

- **WHEN** a portable plugin `mcp.json` declares a secret-like env key name
- **THEN** existing Agent Plugins refusal/diagnostic behavior MUST still apply independently of consumer MCP bake

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
