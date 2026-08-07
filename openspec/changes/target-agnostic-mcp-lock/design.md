## Context

The target API already routes MCP configuration through registered target capabilities, but core derives a fallback path and writes one fixed inventory key. The affected requirements are defined in this change's delta specs.

## Goals / Non-Goals

**Goals:**
- Carry the target-reported MCP configuration path through install to lock inventory.
- Associate MCP configuration inventory with the target that performed the configuration.
- Preserve pre-existing lock inventory without automatic migration.

**Non-Goals:**
- Migrating legacy lockfile entries.
- Adding another target package or changing Cursor's on-disk MCP format.
- Generalizing compile, marketplace outputs, exclude validation, or deployed-file attribution.

## Decisions

### Configure reports are the sole source of configuration paths

Core will require a successful MCP configure operation to report a non-empty project-relative configuration path and will pass that value to lock inventory write-back.

This keeps target filesystem layout with its implementation. A core fallback would reintroduce an implicit default target and cannot be correct for arbitrary registered targets.

### MCP configuration inventory is keyed by target id

The target id passed to the registered configure capability will be the key used for the configuration entry. Server membership remains represented by the existing server and target-server inventory fields.

This aligns the configuration metadata with the active target without changing the lock's broader MCP inventory model.

### Legacy data is preserved, not migrated

Loaded MCP inventory is merged as unknown-compatible data. The write path only adds or updates the entry for the target that just configured MCP.

This avoids a breaking lockfile migration and respects the chosen compatibility policy. Users can regenerate a lock later if they want a fully current representation.

### Acceptance is behavioural

Acceptance coverage will register a mock non-Cursor target that reports a distinct MCP path, run non-frozen install, and assert the resulting lock metadata. A Cursor regression case will assert that its target report still records `.cursor/mcp.json`. Tests will not inspect imports, source literals, or filesystem implementation locations.

## Risks / Trade-offs

- [Older or third-party targets omit a configuration path] → Treat the report as invalid and fail before replacing MCP inventory; update the target contract and Cursor implementation together.
- [Historical inventory contains inconsistent shapes] → Preserve it untouched unless the current target's own entry is updated.
- [One install configures multiple targets in a later feature] → The current install flow selects one configured target; a future multi-target change can generalize the operation to a collection of reports without changing the target-keyed model.

## Migration Plan

1. Extend the target MCP configure report and make Cursor return its existing path.
2. Replace core's fixed MCP inventory key and path fallback with the report and active target id.
3. Add behavioural acceptance and unit coverage.
4. Existing lockfiles remain valid and are preserved; no rewrite-only migration runs.

Rollback consists of reverting the implementation while leaving existing lock entries untouched; no data migration must be undone.
