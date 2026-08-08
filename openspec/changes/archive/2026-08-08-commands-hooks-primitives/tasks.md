## 1. Discovery (core)

- [x] 1.1 Extend `Primitives` discovery to emit `command` from `.apm/prompts/*.prompt.md` and package-root `*.prompt.md` (name = stem)
- [x] 1.2 Extend discovery to emit `hook` from `.apm/hooks/*.json` and top-level `hooks/*.json` (hook-only packages included)
- [x] 1.3 Add/adjust unit tests for attribution + conflict resolution with command/hook name+type collisions (local wins, first-declared dep wins)

## 2. Cursor materialize

- [x] 2.1 Implement command writer: Claude-format subset → `.cursor/commands/<name>.md`; drop non-preserved frontmatter with diagnostics; report deployed paths
- [x] 2.2 Implement hooks merge into `.cursor/hooks.json` (Cursor flat `command` shape) with script copy/rewrite under registered `.cursor/` roots
- [x] 2.3 Add ownership sidecar (`.cursor/bapm-hooks.json` or equivalent) + preserve unrelated user hook entries; idempotent re-install
- [x] 2.4 Unit/e2e tests for Cursor command + hook materialize and inventory reporting

## 3. OpenCode materialize

- [x] 3.1 Implement command writer → `.opencode/commands/<name>.md` under registered roots; report deployed paths
- [x] 3.2 Replace silent hooks skip with inspectable non-fatal skip diagnostic; ensure hooks do not write OpenCode harness files
- [x] 3.3 Unit/e2e tests for OpenCode commands deploy and hooks skip diagnostic

## 4. Agent Plugins declared commands/hooks

- [x] 4.1 Map `plugin.json` `commands`/`hooks` path entries (APM-compatible shapes) into attributed command/hook primitives under plugin root
- [x] 4.2 Fail closed on missing or escaping declared paths before deploy/lock commit
- [x] 4.3 Update `compatibility-cases.json`, regenerate/check Agent Plugins matrix, and adjust `unsupported-components` / docs (`AGENT_PLUGINS_COMPATIBILITY.md`, guide) so commands/hooks are supported (not blanket not-supported)
- [x] 4.4 Tests: happy-path declared command/hook on Cursor; fail-closed missing/escape; matrix check passes

## 5. Install inventory & docs polish

- [x] 5.1 Confirm install/orphan path records and cleans command/hook deployed files via existing lock inventory
- [x] 5.2 Brief producer/consumer docs notes: prompts→commands, hooks layouts, Cursor/OpenCode matrix, Agent Plugins declared-path rule
- [x] 5.3 Run focused `vp` test suites for touched packages and fix regressions
