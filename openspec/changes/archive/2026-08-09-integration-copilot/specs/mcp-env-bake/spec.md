## ADDED Requirements

### Requirement: Translate-mode hosts skip install-time bake of APM placeholders

When an active integration declares MCP env policy `translate` (via the integration-api contract), install MUST NOT bake APM-style `${VAR}`, `${env:VAR}`, or legacy `<VAR>` placeholders into literal process-environment values before calling that integration’s `configureMcp`. Those placeholders MUST be passed through for the host to write as runtime `${VAR}` forms. Cursor and other bake-mode hosts MUST retain install-time bake behavior unchanged. Bapm-only `{bake:NAME}` / `{bake:env:NAME}` directives MAY still be resolved at install time even for translate-mode hosts when present; unresolved `{bake:…}` MUST fail closed as for bake-mode hosts.

#### Scenario: Translate host receives unresolved APM placeholders

- **WHEN** install configures MCP for an integration with `mcpEnvMode: "translate"` and a server env value is `${API_TOKEN}` with `API_TOKEN` set in the process environment
- **THEN** the server definition passed to that host’s `configureMcp` MUST retain a placeholder form rather than the secret literal from the environment

#### Scenario: Cursor bake path remains bake-only

- **WHEN** install configures MCP for Cursor (bake-mode) with `${API_TOKEN}` and `API_TOKEN` set
- **THEN** Cursor configure MUST still receive the baked literal value as required by existing Cursor bake requirements

## MODIFIED Requirements

### Requirement: No Cursor runtime translate-mode

For the Cursor host path, the system MUST use install-time bake only. It MUST NOT rewrite MCP env/header values into host runtime placeholders (for example leaving `${VAR}` for Cursor to expand later) as a substitute for bake. This Cursor-only constraint MUST NOT prohibit other integrations from declaring translate-mode MCP env policy.

#### Scenario: Baked config contains literals not runtime placeholders

- **WHEN** bake succeeds for `${API_TOKEN}` with a known env value on the Cursor path
- **THEN** the written Cursor `mcpServers` entry env MUST store the literal value and MUST NOT store `${API_TOKEN}` as a runtime placeholder

#### Scenario: Non-Cursor translate hosts are out of this Cursor constraint

- **WHEN** an integration other than Cursor declares translate-mode MCP env policy
- **THEN** that host MUST NOT be forced into Cursor bake-only rewrite rules solely by this requirement
