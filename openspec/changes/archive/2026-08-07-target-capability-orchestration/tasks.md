## 1. Registry and target contracts

- [x] 1.1 Extend `bapm-target-api` registry contracts with one-pass detected-target querying, registered-id lookup, and documented non-match diagnostics.
- [x] 1.2 Add generic target compile-emission and target-owned deployment-report attribution contracts; export them from the public API without adding concrete-host imports.
- [x] 1.3 Move Cursor compile rendering, default output selection, and output-path validation into `bapm-target-cursor`; preserve deterministic content and validate/dry-run no-write behavior.
- [x] 1.4 Add target-api and target-cursor unit coverage for detection query, compile capability, default/overridden outputs, and target-owned reports.

## 2. Core target orchestration

- [x] 2.1 Implement one selection service shared by compile, install materialization, and MCP configuration: explicit registered id wins; exactly one detected target auto-selects; zero/multiple detections fail with `--target <id>` guidance.
- [x] 2.2 Refactor core compile orchestration to discover and conflict-resolve primitives, then delegate all target output rendering/path choice to the selected target capability; reject missing capabilities without a Cursor fallback.
- [x] 2.3 Refactor install materialization and MCP configuration to consume a single selection result rather than re-running detection loops, retaining manifest target intersection only as a post-selection primitive filter.
- [x] 2.4 Normalize and validate target deployment/MCP reports before lock write-back so deployment ownership, paths, and hashes originate only in selected target packages; remove concrete-target attribution fallbacks.
- [x] 2.5 Validate every exclude id against the injected registry before target configuration writes; retain exclude as a configuration filter rather than an install skip.
- [x] 2.6 Add core unit coverage for sole/no/ambiguous detection, forced selection, missing compile capability, report attribution, and registered/unregistered excludes.

## 3. CLI composition and surface

- [x] 3.1 Create or extend one CLI composition-root registry factory that registers shipped target packages and inject it into both compile and install paths.
- [x] 3.2 Add `compile --target <id>` and `--target=<id>` parsing, forwarding, help text, and clear errors for required/unknown/non-compile-capable targets.
- [x] 3.3 Update CLI compile/install tests for automatic selection, explicit fallback when no or multiple targets detect, help guidance, and registry-derived exclude validation.

## 4. Verification

- [x] 4.1 Run focused target-api, target-cursor, core, and CLI tests plus typecheck/lint/format checks; fix regressions without weakening selection or attribution rules.
- [x] 4.2 Run `openspec validate target-capability-orchestration --strict` and resolve all validation findings.
