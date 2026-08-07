## Why

The MCP install flow calls targets through `bapm-target-api`, yet its lock inventory still assumes Cursor by using the `cursor` key and `.cursor/mcp.json` fallback. This makes a registered non-Cursor MCP target record incorrect lock metadata and violates the intended core-to-target boundary.

## What Changes

- Record an MCP configuration in the lock under the target id that actually configured it, using the configuration path reported by that target.
- Remove Cursor-specific defaults from core MCP lock write-back; a target that configures MCP must provide its output path.
- Preserve existing lock inventory fields unchanged when they are read, while writing new target-specific entries without migrating legacy data.
- Add behavioural coverage with a non-Cursor registered target and retain Cursor MCP compatibility coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `target-api-contracts`: require the optional MCP configure contract to report its written configuration path.
- `install-pipeline`: make MCP lock inventory target-specific when a registered target configures MCP.
- `cursor-mcp-deploy`: clarify that Cursor supplies its own MCP output path through the target contract.
- `lockfile-yaml-rw`: preserve legacy MCP inventory while serializing newly written target-keyed MCP configuration inventory.

## Impact

- `packages/core/src/modules/Install/runInstall.ts`
- `packages/core/src/modules/Mcp/lockInventory.ts` and its tests
- `packages/target-api` and `packages/target-cursor` MCP contract/report implementation
- Lockfile write-back behaviour; no dependency additions and no automatic legacy-lock migration
