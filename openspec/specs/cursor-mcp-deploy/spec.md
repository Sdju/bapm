# cursor-mcp-deploy Specification

## Purpose

Defines Cursor MCP config deploy on install: collect direct MCP dependencies, write `.cursor/mcp.json` under registered cursor roots, and update lock `mcp_*` fields without inventing a second host target.

## Requirements

### Requirement: Collect direct MCP dependencies for deploy

On install, the system MUST collect MCP server definitions from the consuming project's direct `dependencies.mcp` (and equivalent dual-read manifest shape). Transitive MCP from dependencies MUST NOT be auto-deployed unless an explicit trust flag (APM-like `--trust-transitive-mcp`) is set or the MCP is re-declared as a direct dependency. The default MUST be direct-only.

#### Scenario: Direct MCP is collected

- **WHEN** the project manifest lists a direct `dependencies.mcp` stdio or http server entry
- **THEN** that entry MUST be eligible for Cursor MCP deploy when the cursor target is active

#### Scenario: Transitive MCP skipped by default

- **WHEN** only a transitive dependency declares MCP servers and no trust-transitive flag is set
- **THEN** those transitive MCP servers MUST NOT be written into `.cursor/mcp.json`

### Requirement: Write Cursor mcp.json under registered roots

When the cursor target is active (positive detect or forced `--target cursor`) and eligible MCP servers exist after trust gating, install MUST write or update `.cursor/mcp.json` in Cursor `mcpServers` shape (stdio and/or http) via `bapm-integration-cursor` (or a thin integration-api helper implemented by cursor). Writes MUST stay under the registered `.cursor/` root and MUST NEVER escape registered deploy roots.

#### Scenario: Direct MCP install writes mcp.json

- **WHEN** `bapm install --target cursor` runs with a direct MCP stdio dependency and trust allows deploy
- **THEN** `.cursor/mcp.json` MUST contain that server under `mcpServers` and exit code MUST be success

#### Scenario: MCP write never escapes cursor root

- **WHEN** MCP deploy runs for an active cursor target
- **THEN** no MCP config path outside registered `.cursor/` roots MUST be written

### Requirement: Detect honesty for MCP without inventing cursor root

Auto-detect without forced target MUST NOT create `.cursor/` solely to opt into MCP. When neither `.cursor/` nor `.cursorrules` is present and target is not forced, install with MCP deps MUST skip MCP harness writes (MAY warn or document skip) and MUST NOT invent a second host. Forced `--target cursor` MAY create registered roots including `.cursor/` as needed.

#### Scenario: No cursor signal skips MCP mkdir

- **WHEN** install runs without `--target cursor` and neither `.cursor/` nor `.cursorrules` exists
- **THEN** install MUST NOT create `.cursor/` solely for MCP and MUST NOT write `.cursor/mcp.json`

#### Scenario: Forced cursor may create root for MCP

- **WHEN** install runs with forced target `cursor` and MCP deploy is eligible
- **THEN** `.cursor/mcp.json` MAY be written after creating the registered `.cursor/` root

### Requirement: Idempotent owned MCP entries

Re-running install with the same eligible MCP set MUST leave owned `mcpServers` keys stable (idempotent overwrite of bapm-owned entries). User-edited keys outside the owned set SHOULD be preserved when inexpensive; ownership rules MUST be documented thinly.

#### Scenario: Second install stable owned keys

- **WHEN** install deploys MCP then runs again with the same eligible set
- **THEN** owned entries in `.cursor/mcp.json` MUST remain semantically stable

### Requirement: Lock mcp fields updated after MCP deploy

When Cursor MCP configuration is written, lock write-back MUST populate or update applicable top-level `mcp_*` fields (`mcp_servers`, `mcp_configs`, `mcp_target_servers`, `mcp_config_provenance` as modeled) consistently with APM lock spirit, while preserving unknown/`x-*` keys. Cursor's registered target MCP configure report MUST supply `.cursor/mcp.json` as the written configuration path; core MUST consume that reported path through the target API rather than supplying a Cursor-specific fallback.

#### Scenario: Lock lists configured MCP after install

- **WHEN** a non-frozen install successfully writes Cursor MCP config
- **THEN** the lockfile MUST include MCP inventory fields covering the configured servers

#### Scenario: Cursor report supplies its configuration path

- **WHEN** Cursor successfully configures eligible MCP servers
- **THEN** its target configure report MUST identify `.cursor/mcp.json` as the written configuration path

### Requirement: Projects without MCP never require mcp.json

Install for projects without MCP dependencies MUST NOT require `.cursor/mcp.json` to exist and MUST NOT fail for its absence (M5 regression).

#### Scenario: No MCP leaves mcp.json optional

- **WHEN** install runs for a project with no MCP deps and cursor skills/rules deploy
- **THEN** success MUST NOT depend on creating `.cursor/mcp.json`

### Requirement: Portable Agent Plugins MCP is adapted, not copied

When an eligible portable Agent Plugins v1 dependency contributes root `mcp.json`, Cursor MUST adapt its supported transports into Cursor configuration: `stdio` to `stdio`, `streamable-http` to `http`, and `sse` to `sse`. The target MUST NOT copy portable-only metadata or imply that all Agent Plugins clients use the Cursor shape.

#### Scenario: Portable streamable HTTP maps to Cursor HTTP

- **WHEN** an installed portable plugin contributes a valid `streamable-http` MCP server and Cursor is active
- **THEN** `.cursor/mcp.json` contains that server with `type: "http"` and its URL

### Requirement: Excluded cursor skips MCP configure writes

When install’s exclude set includes `cursor`, Cursor MCP deploy MUST NOT write or update `.cursor/mcp.json` for that invocation, even if the cursor target is otherwise active and eligible MCP servers exist. Package skill/rule/agent materialize MAY still occur. A warning or diagnostic that MCP configure was skipped SHOULD be emitted when inexpensive.

#### Scenario: Exclude cursor leaves mcp.json untouched

- **WHEN** install runs with exclude including `cursor`, forced or detected cursor active, and eligible direct MCP
- **THEN** `.cursor/mcp.json` MUST remain unchanged (or absent if previously absent) and MUST NOT be created solely by configureMcp on that run

### Requirement: Install only-apm skips Cursor MCP configure

When install only-mode is `apm`, Cursor MCP deploy MUST NOT write or update `.cursor/mcp.json` for that invocation, even if the cursor target is otherwise active and eligible MCP servers exist. Package skill/rule/agent materialize MAY still occur. Behavior MUST be consistent with exclude-cursor MCP skip for the configure side.

#### Scenario: only apm leaves mcp.json unchanged

- **WHEN** install runs with only-mode `apm`, forced or detected cursor active, and eligible direct MCP
- **THEN** `.cursor/mcp.json` MUST remain unchanged (or absent if previously absent) and MUST NOT be created solely by configureMcp on that run

### Requirement: Cursor MCP deployment is an integration capability

Cursor MCP configuration MUST be provided by the registered `bapm-integration-cursor` MCP capability through `bapm-integration-api`. Install orchestration MUST remain host-neutral and MUST NOT use a legacy package import, alias, or Cursor-specific fallback outside the registered capability report.

#### Scenario: Cursor config is selected through integration registry

- **WHEN** install configures eligible MCP servers for an active Cursor project
- **THEN** it invokes the Cursor integration capability and records the project-relative configuration path reported by that capability
