# cursor-mcp-deploy Specification

## Purpose

Defines the install-time MCP deploy contract for a registered target integration: collect eligible MCP dependencies, bake `env` / `headers`, invoke each active target's MCP configure capability, write the host-specific MCP configuration path, and record target-keyed lock inventory. Cursor is the reference host and `.cursor/mcp.json` is the reference shape, but this capability is not Cursor-only: the same contract applies to every registered target that exposes MCP configure, and targets without that capability are skipped.

## Requirements

### Requirement: Collect direct MCP dependencies for deploy

On install, the system MUST collect MCP server definitions from the consuming project's direct `dependencies.mcp` (and equivalent dual-read manifest shape). A directly installed portable Agent Plugin's root `mcp.json` follows direct-MCP eligibility. Transitive MCP from dependency packages MUST NOT be auto-deployed unless an explicit trust flag (APM-like `--trust-transitive-mcp`) or an executable grant surface makes it eligible; sc-009 executable trust still withholds unapproved dependency MCP. The default MUST be direct-only.

#### Scenario: Direct MCP is collected

- **WHEN** the project manifest lists a direct `dependencies.mcp` stdio or http server entry
- **THEN** that entry MUST be eligible for target MCP deploy when an MCP-capable target is active

#### Scenario: Transitive MCP skipped by default

- **WHEN** only a transitive dependency declares MCP servers and neither trust-transitive nor a grant surface makes it eligible
- **THEN** those transitive MCP servers MUST NOT be written into any target MCP configuration

#### Scenario: Trust flag includes dependency MCP

- **WHEN** install runs with `--trust-transitive-mcp` and an approved dependency declares MCP servers
- **THEN** those servers MUST become eligible for target MCP deploy subject to executable trust

### Requirement: Configure MCP through the active target's capability

When eligible MCP servers exist after trust gating, install MUST invoke the MCP configure capability (`configureMcp` or a documented alias) of each active registered target that exposes it, passing the host-agnostic server contract. Install orchestration MUST remain host-neutral and MUST NOT use a legacy package import, alias, or Cursor-specific fallback outside the registered capability report. A target that does not expose MCP configure MUST be skipped without failing MCP deploy for other targets. Each configure report MUST identify the configuring target; install MUST reject a report whose target attribution does not match the invoked target.

#### Scenario: Target config is selected through the integration registry

- **WHEN** install configures eligible MCP servers for an active project
- **THEN** it invokes the registered target capability and records the configuration path reported by that capability

#### Scenario: Configure report must be target-attributed

- **WHEN** an active target's MCP configure report omits or mismatches its target id
- **THEN** install MUST fail instead of recording inventory under an invented target

#### Scenario: Target without MCP capability is skipped

- **WHEN** an active target such as Grok Build does not expose MCP configure and eligible servers exist
- **THEN** install MUST skip MCP configure for that target and MUST continue for other MCP-capable targets

### Requirement: Target owns its host-specific MCP configuration path

Each target MUST report the project-relative, absolute, or home-scoped path it wrote and use its native configuration shape. Shipped mappings are:

- Cursor: `.cursor/mcp.json` with `mcpServers`
- Claude: `.mcp.json` with `mcpServers`
- Codex: `.codex/config.toml` with `mcp_servers`
- OpenCode: `opencode.json` with `mcp`
- Gemini: `.gemini/settings.json` with `mcpServers`
- Kiro: `.kiro/settings/mcp.json` with `mcpServers`
- Antigravity: `.agents/mcp_config.json` with `mcpServers`
- Copilot: `~/.copilot/mcp-config.json` (or `COPILOT_HOME`) with `mcpServers`
- Windsurf: `~/.codeium/windsurf/mcp_config.json` (or `CODEIUM_HOME`) with `mcpServers`

Project-scoped writes MUST stay under the target's registered deploy roots and MUST NEVER escape them. Home-scoped writes MUST stay under the target's declared home configuration root. Core MUST consume the path reported by the target rather than supplying a host-specific fallback.

#### Scenario: Cursor report supplies its configuration path

- **WHEN** Cursor successfully configures eligible MCP servers
- **THEN** its target configure report MUST identify `.cursor/mcp.json` as the written configuration path

#### Scenario: Codex uses its native TOML path

- **WHEN** Codex configures eligible MCP servers
- **THEN** the report MUST identify `.codex/config.toml` and the file MUST use the `mcp_servers` table

#### Scenario: Home-scoped hosts write under home config

- **WHEN** Copilot or Windsurf configures eligible MCP servers
- **THEN** the report path MUST be the host's home MCP config path and no project-scoped MCP config file MUST be created

#### Scenario: MCP write never escapes target roots

- **WHEN** MCP deploy runs for an active project-scoped target
- **THEN** no MCP config path outside that target's registered deploy roots MUST be written

### Requirement: Detect honesty for MCP without inventing a host root

Auto-detect without forced target MUST NOT create a project host directory or MCP config solely to opt into MCP when no target was otherwise selected. A host that treats its project directory as an explicit MCP opt-in MUST skip rather than invent that directory; a selected target whose config file is safe to create MAY create its own declared project root. Forced `--target <id>` MAY create the selected target's registered project roots when that target supports it. Home-scoped hosts write under their home config root and MUST NOT create project host directories for MCP.

#### Scenario: No selected target creates no MCP root

- **WHEN** install cannot select a target without `--target` and direct MCP dependencies exist
- **THEN** install MUST fail before creating any project host directory or MCP config solely for MCP

#### Scenario: File-marker detect does not invent an opt-in directory

- **WHEN** Claude is detected through project-root `CLAUDE.md` but `.claude/` is absent
- **THEN** install MUST NOT create `.claude/` or `.mcp.json` solely for MCP and MUST emit the documented skip warning

#### Scenario: Forced target may create its registered root

- **WHEN** install runs with forced target `cursor` and MCP deploy is eligible
- **THEN** `.cursor/mcp.json` MAY be written after creating the registered `.cursor/` root

### Requirement: Missing host directory skips MCP with a warning

When an active project-scoped target requires its host directory (for example `.claude/`, `.gemini/`, `.kiro/`, or `.agents/`) and that directory is absent, the target MUST skip its MCP configuration write, MUST leave any existing MCP config file unchanged, and MUST report a warning diagnostic containing the target id and missing directory. Install MUST surface that diagnostic as a `bapm: warning:` line on stderr rather than silently skipping or failing the install.

#### Scenario: Claude missing .claude warns and does not write

- **WHEN** Claude is active, `.claude/` is absent, and eligible direct MCP servers exist
- **THEN** install MUST print a `bapm: warning:` naming `.claude/` and MUST NOT create `.mcp.json`

#### Scenario: Opt-in host skip preserves existing config

- **WHEN** Gemini, Kiro, or Antigravity is active, its host directory is absent, and a prior MCP config file exists
- **THEN** the prior config file MUST remain unchanged and the skip warning MUST be emitted

### Requirement: Idempotent owned MCP entries

Re-running install with the same eligible MCP set MUST leave owned `mcpServers` (or the target's equivalent) keys stable, with idempotent overwrite of bapm-owned entries. User-edited keys outside the owned set SHOULD be preserved when inexpensive; ownership rules MUST be documented per target.

#### Scenario: Second install stable owned keys

- **WHEN** install deploys MCP then runs again with the same eligible set
- **THEN** owned entries in the target MCP config MUST remain semantically stable and unowned keys MUST remain intact

### Requirement: Lock MCP server inventory after MCP deploy

When MCP deploy is evaluated, non-frozen install MUST populate or update top-level lock `mcp_servers` for the eligible authored servers while preserving unknown and `x-*` keys. Entries MUST retain package provenance and authored placeholders rather than baked secrets. Lock `mcp_config_provenance` MUST record each server's package and configuration path; when several targets are configured, the last configured target's path wins for that field, matching the historical single-path shape.

#### Scenario: Lock lists configured MCP after install

- **WHEN** a non-frozen install successfully writes target MCP config
- **THEN** `mcp_servers` MUST include the configured servers with package provenance

#### Scenario: Lock keeps authored placeholders

- **WHEN** an eligible server's `env` uses `${API_TOKEN}` and the target write bakes the literal value
- **THEN** the lock's `mcp_servers` entry MUST keep the authored placeholder rather than the baked secret

### Requirement: MCP config inventory is keyed by the configuring target

When a registered target successfully configures MCP and reports a usable configuration path, non-frozen install MUST record `mcp_configs[targetId]` with that normalized path and server list and `mcp_target_servers[targetId]` with the same server names. Core MUST NOT substitute a Cursor id or Cursor filesystem path for a different target. Existing inventory entries not written by the current configure operation MUST be preserved unchanged. A target report without a non-empty usable path MUST fail before replacement inventory is written.

#### Scenario: Non-Cursor target writes its own MCP inventory

- **WHEN** an active registered target with id `x-acme-editor` configures MCP and reports `config/mcp.json`
- **THEN** the updated lock MUST record `x-acme-editor` with `config/mcp.json` in `mcp_configs` and its server names in `mcp_target_servers`, and MUST NOT add a Cursor-path entry

#### Scenario: Multi-target inventory records every configured host

- **WHEN** install configures MCP for two active MCP-capable targets
- **THEN** `mcp_configs` and `mcp_target_servers` MUST contain one entry per configured target id

#### Scenario: Existing legacy inventory is preserved

- **WHEN** a lock already contains a legacy MCP inventory entry and another registered target configures MCP
- **THEN** lock write-back MUST preserve the legacy entry unchanged while adding or updating the configuring target's inventory

#### Scenario: Configure without a path fails before lock write-back

- **WHEN** an active target reports successful MCP configuration without a non-empty usable path
- **THEN** install MUST fail without writing a replacement MCP inventory entry

### Requirement: Multi-active install configures every MCP-capable host

When manifest `active` lists several targets, install MUST run MCP configure for every active target that exposes the capability and has eligible servers, recording each result under its own target id. A forced `--target <id>` MUST limit MCP configure to that target. Multi-active install MUST NOT pick one MCP host implicitly or merge several host configs into one file.

#### Scenario: Two active hosts each receive MCP config

- **WHEN** `active` lists Cursor and Claude, both expose MCP configure, and eligible direct MCP exists
- **THEN** install MUST configure both hosts and record both target entries in the lock

#### Scenario: Forced target limits MCP configure

- **WHEN** install runs with `--target cursor` and manifest `active` lists several hosts
- **THEN** only Cursor's MCP configure MUST run and only Cursor's inventory entry MUST be written by that operation

### Requirement: Excluded target skips MCP configure writes

When install's exclude set includes a target id, that target's MCP configure MUST NOT write or update its MCP config for that invocation, even if the target is otherwise active and eligible MCP servers exist. Package skill/rule/agent materialize MAY still occur. Install SHOULD emit a warning or diagnostic that MCP configure was skipped for that target.

#### Scenario: Exclude target leaves its MCP config untouched

- **WHEN** install runs with exclude including a target id, that target is forced or detected active, and eligible direct MCP exists
- **THEN** that target's MCP config MUST remain unchanged (or absent if previously absent) and MUST NOT be created solely by MCP configure on that run

### Requirement: Install only-apm skips MCP configure

When install only-mode is `apm`, MCP configure MUST NOT write or update any target MCP config for that invocation, even if targets are active and eligible MCP servers exist. Package skill/rule/agent materialize MAY still occur. Behavior MUST be consistent with exclude-target MCP skip for the configure side.

#### Scenario: Only apm leaves MCP config unchanged

- **WHEN** install runs with only-mode `apm`, a target is active, and eligible direct MCP exists
- **THEN** no target MCP config MUST be written or updated by that run

### Requirement: Projects without MCP never require a target MCP config

Install for projects without MCP dependencies MUST NOT require any target MCP config file to exist and MUST NOT fail for its absence.

#### Scenario: No MCP leaves MCP config optional

- **WHEN** install runs for a project with no MCP deps and target skills/rules deploy
- **THEN** success MUST NOT depend on creating a target MCP config file

### Requirement: Portable Agent Plugins MCP is adapted, not copied

When an eligible portable Agent Plugins v1 dependency contributes root `mcp.json`, each target MUST adapt supported transports into its own configuration shape. For the reference Cursor target, `stdio` maps to `stdio`, `streamable-http` maps to `http`, and `sse` maps to `sse`. A target MUST NOT copy portable-only metadata or imply that all Agent Plugins clients use the Cursor shape.

#### Scenario: Portable streamable HTTP maps to Cursor HTTP

- **WHEN** an installed portable plugin contributes a valid `streamable-http` MCP server and Cursor is active
- **THEN** `.cursor/mcp.json` contains that server with `type: "http"` and its URL

#### Scenario: Portable metadata is not copied

- **WHEN** a portable MCP server is adapted into a target config
- **THEN** portable-only fields such as `format` and package metadata MUST NOT be persisted as host config fields

### Requirement: Translate MCP env and headers before target config write

Before a target MCP configure writes durably, the system MUST resolve bapm `{bake:…}` directives in `env` and `headers` string values per the `mcp-env-bake` capability. APM placeholders (`${VAR}`, `${env:VAR}`, legacy `<VAR>`) MUST be baked for bake-mode hosts and passed through for translate-mode hosts (`mcpEnvMode`, or per-map `mcpHeadersEnvMode` for headers). Unresolved `{bake:…}` MUST fail closed before a successful MCP config write. Cursor and OpenCode MUST receive placeholder forms and write their native runtime references instead of baking secrets into project-local config.

#### Scenario: Cursor writes native placeholder instead of literal

- **WHEN** `bapm install --target cursor` deploys a direct MCP stdio server whose `env` uses `${API_TOKEN}` and `API_TOKEN` is set in the environment
- **THEN** `.cursor/mcp.json` MUST contain `${env:API_TOKEN}` under that server's `env`, not the literal token value, and the lock MUST keep `${API_TOKEN}`

#### Scenario: Unresolved {bake:} blocks successful MCP write

- **WHEN** install would deploy MCP with an unresolved `{bake:MISSING}` in `env` and no override supplies it
- **THEN** install MUST NOT succeed while leaving `{bake:MISSING}` in a target MCP config

#### Scenario: Codex headers use native indirection

- **WHEN** a Codex remote server declares `Authorization: "Bearer ${TOKEN}"` and `TOKEN` is set
- **THEN** `.codex/config.toml` MUST use `bearer_token_env_var` rather than a literal header value

### Requirement: Registry-only MCP entries fail closed before deploy

MCP lookup from a registry is not implemented. Before any host MCP config or MCP lock inventory is written, install MUST reject an eligible direct or dependency MCP entry that requests registry lookup (`registry` is `true` or a non-empty string) and provides neither `command` nor `url`. The failure MUST use the `MCP_REGISTRY_UNSUPPORTED` code and name the offending server. Self-defined entries (`registry: false`) with `command`/`url` MUST continue to deploy normally.

#### Scenario: Root registry-only entry blocks host write

- **WHEN** the root manifest declares `mcp: [{ name: public, registry: true }]` and an MCP-capable target is active
- **THEN** install MUST fail with `MCP_REGISTRY_UNSUPPORTED` naming `public` and MUST NOT write any target MCP config or MCP lock inventory

#### Scenario: Dependency registry-only entry blocks host write

- **WHEN** an approved dependency contributes an MCP entry with `registry` and no `command`/`url`
- **THEN** install MUST fail with `MCP_REGISTRY_UNSUPPORTED` naming that server before host config is written

#### Scenario: Self-defined entries are not blocked

- **WHEN** an eligible entry declares `registry: false` with `command` or `url`
- **THEN** install MUST treat it as self-defined and configure it normally
