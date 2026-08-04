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
When the cursor target is active (positive detect or forced `--target cursor`) and eligible MCP servers exist after trust gating, install MUST write or update `.cursor/mcp.json` in Cursor `mcpServers` shape (stdio and/or http) via `bapm-target-cursor` (or a thin target-api helper implemented by cursor). Writes MUST stay under the registered `.cursor/` root and MUST NEVER escape registered deploy roots.

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
When MCP config is written, lock write-back MUST populate or update applicable top-level `mcp_*` fields (`mcp_servers`, `mcp_configs`, `mcp_target_servers`, `mcp_config_provenance` as modeled) consistently with APM lock spirit, while preserving unknown/`x-*` keys.

#### Scenario: Lock lists configured MCP after install
- **WHEN** a non-frozen install successfully writes Cursor MCP config
- **THEN** the lockfile MUST include MCP inventory fields covering the configured servers

### Requirement: Projects without MCP never require mcp.json
Install for projects without MCP dependencies MUST NOT require `.cursor/mcp.json` to exist and MUST NOT fail for its absence (M5 regression).

#### Scenario: No MCP leaves mcp.json optional
- **WHEN** install runs for a project with no MCP deps and cursor skills/rules deploy
- **THEN** success MUST NOT depend on creating `.cursor/mcp.json`
