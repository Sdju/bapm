## ADDED Requirements

### Requirement: Domain modules for MCP trust compile and cache

MCP collect/deploy orchestration helpers, executable trust (sc-009) evaluation, `AGENTS.md` compile emit, and modules-cache info/clean helpers MUST live under `packages/core/src/modules/` as directory module(s) with `index.ts` public entries (names flexible, e.g. `Mcp`, `Compile`, `Cache`, `ExecutableTrust`, or composed under Install). Deep imports into those modules' internals from outside MUST NOT be used. Single-file modules MUST NOT be used. These modules MUST NOT import `bapm-target-cursor` or other concrete target packages; MCP configure MUST go through `bapm-target-api` when invoked from core. New public symbols MUST be re-exported from the package entry via `app/publicApi`.

#### Scenario: App imports M9 modules only via public entries

- **WHEN** app public API code needs MCP trust, compile, or cache behavior
- **THEN** it MUST import from the corresponding `@/modules/<Name>` entry and MUST NOT deep-import module internals

#### Scenario: M9 core modules do not hard-depend on cursor

- **WHEN** compile or MCP orchestration runs inside `@b-apm/core`
- **THEN** those modules MUST NOT import `bapm-target-cursor` and MUST NOT require a new `bapm-target-*` package
