# mcp-env-bake Specification

## Purpose

Install-time resolution of OpenAPM/APM MCP env and header placeholders. Hosts that support runtime interpolation keep placeholder references in their native form; hosts without runtime interpolation (for example Codex stdio `env`) bake literals at install time. Bapm `{bake:NAME}` directives always resolve at install time, fail-closed.

## Requirements

### Requirement: Resolve MCP placeholder syntaxes at bake time

For a host that bakes MCP values, before writing host MCP configuration the system MUST resolve placeholder tokens in string values of MCP `env` maps (and `headers` maps when they are not translated) using OpenAPM/APM-compatible syntaxes: `${VAR}`, `${env:VAR}`, and legacy `<VAR>` (uppercase name). Resolution MUST prefer an explicit override map when provided by the caller, then a non-empty value from the process environment, then a non-empty value from the project manifest top-level `env` map when present. Values that contain no placeholders MUST pass through unchanged. Single-brace `{name}` APM-internal template variables and `${input:…}` interactive inputs are OUT OF SCOPE for this capability unless a later change adds them.

#### Scenario: ${VAR} bakes from process env

- **WHEN** an eligible MCP server declares `env.API_TOKEN: "${API_TOKEN}"`, the host bakes env values, and `API_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal environment value, not the placeholder string

#### Scenario: ${env:VAR} bakes equivalently

- **WHEN** an eligible MCP server declares `env.TOKEN: "${env:MY_TOKEN}"`, the host bakes env values, and `MY_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal `MY_TOKEN` value

#### Scenario: Legacy angle placeholder bakes

- **WHEN** an eligible MCP server declares `env.TOKEN: "<MY_TOKEN>"`, the host bakes env values, and `MY_TOKEN` is set in the process environment
- **THEN** the baked server env MUST contain the literal `MY_TOKEN` value

#### Scenario: Manifest env fills when process env missing

- **WHEN** an eligible MCP server declares `env.TOKEN: "${PLUGIN_TOKEN}"`, the host bakes env values, process env has no non-empty `PLUGIN_TOKEN`, and the manifest has `env.PLUGIN_TOKEN: "from-yml"`
- **THEN** the baked server env MUST contain `from-yml`

#### Scenario: Process env wins over manifest env

- **WHEN** both process env and manifest `env` define non-empty `API_TOKEN` and bake resolves `${API_TOKEN}`
- **THEN** the baked value MUST be the process environment value

### Requirement: Fail closed when a bake-required placeholder cannot be resolved

When a bake-required placeholder appears in MCP `env` or translated-off `headers` and neither overrides, nor a non-empty process environment value, nor a non-empty manifest top-level `env` value supplies the variable, the system MUST fail the install/configure path with a non-zero outcome and an actionable diagnostic that names the missing variable (never the secret value). The system MUST NOT write unresolved bake-required placeholders into host MCP config. Interactive TTY prompting for missing variables MUST NOT be required for success.

#### Scenario: Missing env var aborts before host MCP write

- **WHEN** a bake-mode host receives MCP env containing `${MISSING_SECRET}` and `MISSING_SECRET` is unset in process env, absent/empty in manifest `env`, and no override supplies it
- **THEN** configure/write for that install MUST NOT complete successfully with the unresolved placeholder, and the diagnostic MUST name `MISSING_SECRET`

### Requirement: Translate-mode hosts keep APM placeholders and write native forms

When an active integration declares MCP env policy `translate` (via `mcpEnvMode`, or per-map `mcpHeadersEnvMode` for headers), install MUST NOT bake APM-style `${VAR}`, `${env:VAR}`, or legacy `<VAR>` placeholders into literal process-environment values before calling that integration’s `configureMcp`. Those placeholders MUST be passed through to the host, and the host MUST write its native runtime reference:

- Cursor: `${env:VAR}` in `env`, optional `args`, and `headers`.
- OpenCode: `{env:VAR}` in local `environment`, command arguments, and remote `headers`.
- Codex: headers only, translated to `env_http_headers` / `bearer_token_env_var` (Codex stdio `env` still bakes because Codex does not interpolate `env`).

Authored native forms (`${env:VAR}` for Cursor, `{env:VAR}` for OpenCode) MUST be preserved. Bapm-only `{bake:NAME}` / `{bake:env:NAME}` directives MUST still be resolved at install time even for translate-mode hosts; unresolved `{bake:…}` MUST fail closed.

#### Scenario: Cursor translate host receives placeholders

- **WHEN** install configures MCP for Cursor with `env.API_TOKEN: "${API_TOKEN}"` and `headers.Authorization: "Bearer ${HEADER_TOKEN}"` while both variables are set in the process environment
- **THEN** `.cursor/mcp.json` MUST contain `${env:API_TOKEN}` and `Bearer ${env:HEADER_TOKEN}`, MUST NOT contain either secret, and the lock MUST keep the authored `${API_TOKEN}` / `Bearer ${HEADER_TOKEN}` forms

#### Scenario: OpenCode translate host receives placeholders

- **WHEN** install configures MCP for OpenCode with `env.API_TOKEN: "${API_TOKEN}"` while `API_TOKEN` is set
- **THEN** `opencode.json` MUST contain `environment.API_TOKEN: "{env:API_TOKEN}"` and MUST NOT contain the secret literal

#### Scenario: Codex headers use native indirection

- **WHEN** install configures a remote Codex MCP server with `Authorization: "Bearer ${TOKEN}"`, a static header, and an exactly-`${VAR}` header
- **THEN** `.codex/config.toml` MUST use `bearer_token_env_var`, `http_headers`, and `env_http_headers` respectively, MUST NOT write the token literal, and the lock MUST keep the authored placeholders

#### Scenario: Header value Codex cannot express is skipped with a warning

- **WHEN** a Codex remote header contains literal text around an environment reference, or an otherwise unsupported interpolation form
- **THEN** the header MUST be skipped with a diagnostic naming the server and header rather than written as static text

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
- **THEN** bake MUST fail before a successful host MCP write and MUST NOT retain the unresolved `{bake:MISSING}` token

### Requirement: Agent Plugins portable MCP path unchanged by this capability

Portable Agent Plugins `mcp.json` parsing (including `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` substitution and refusal of secret-like env keys) MUST remain a separate boundary. This bake capability MUST apply to consumer `dependencies.mcp` (and equivalent collected MCP server configs for host deploy), not redefine Agent Plugins secret policy.

#### Scenario: Agent Plugins secret refuse still applies

- **WHEN** a portable plugin `mcp.json` declares a secret-like env key name
- **THEN** existing Agent Plugins refusal/diagnostic behavior MUST still apply independently of consumer MCP bake

### Requirement: Baked values are not persisted in the lockfile

When install records MCP servers in the lockfile inventory, it MUST record the server declaration as authored before bake: placeholder strings (`${VAR}`, `${env:VAR}`, `<VAR>`, `{bake:VAR}`) MUST appear verbatim and values resolved from the process environment, overrides, or manifest `env` MUST NOT appear in any lockfile (shared or personal). Host MCP configuration files MAY contain baked values only for the host's bake mode or explicit `{bake:}` directives.

#### Scenario: Token stays out of the lock

- **WHEN** a direct MCP server declares `env.API_TOKEN: "${API_TOKEN}"`, `API_TOKEN=secret-123` is set in the process environment, and install writes the host config with a native placeholder or baked value
- **THEN** the written `bapm.lock.yaml` MUST contain `${API_TOKEN}` for that server and MUST NOT contain `secret-123`

#### Scenario: bake directive stays out of the lock

- **WHEN** a server declares `env.KEY: "{bake:KEY}"` and `KEY` resolves to `k-value`
- **THEN** the lock MUST record `{bake:KEY}` and MUST NOT contain `k-value`

### Requirement: Registry-resolved MCP servers preserve authored overlays for bake

When a `dependencies.mcp` entry is resolved through an MCP registry, conversion to the host-agnostic server contract MUST keep the declaration's authored `env` / `headers` overlays and MUST apply the same bake / translate policy as a self-defined server. Registry-provided environment defaults and header values MAY be used as generated inputs, but a registry bearer token and any resolved secret values MUST NOT be written into the lockfile or printed in registry search/show output.

#### Scenario: Authored env overlay still bakes after registry resolution

- **WHEN** a registry-only entry also declares `env.API_TOKEN: "${API_TOKEN}"` and the registry returns a package
- **THEN** the resolved server MUST reach host configure with that authored env value and the existing bake/translate policy, and the lock MUST keep `${API_TOKEN}` rather than the resolved secret

#### Scenario: Registry token is never persisted

- **WHEN** `MCP_REGISTRY_TOKEN` is set for a private registry lookup
- **THEN** no lockfile, manifest, JSON output, or diagnostic emitted by resolution MUST contain the token value
