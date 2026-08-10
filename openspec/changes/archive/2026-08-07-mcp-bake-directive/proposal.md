## Why

Authors need an **explicit** bapm signal that a MCP `env`/`headers` value must be baked at install time. APM `${VAR}` / `${env:VAR}` / `<VAR>` stay for OpenAPM parity, but they do not express “bapm must bake this.” `{bake:NAME}` is a bapm-only extension that marks bake intent clearly and stays bake-required even if a future host leaves APM-style placeholders for runtime.

## What Changes

- Accept `{bake:NAME}` and `{bake:env:NAME}` in MCP `env` / `headers` string values (same maps as existing bake).
- At install bake (before Cursor `configureMcp`), resolve `NAME` from overrides → process env to a non-empty literal; fail closed naming `NAME` if missing (same error class as other bake failures).
- Document as **bapm extension** (not OpenAPM / not APM).
- **Non-BREAKING:** existing APM placeholder forms on Cursor keep current bake behavior; this change only **adds** the directive.
- **Non-goals:** changing Cursor to leave `${VAR}` unbaked; `{bake:${VAR}}` nested form; interactive prompts; Agent Plugins `${PLUGIN_*}` path; inventing `{env}` without `bake:`.

## Capabilities

### New Capabilities

- _(none — extend existing bake capability)_

### Modified Capabilities

- `mcp-env-bake`: Add bapm-only `{bake:NAME}` / `{bake:env:NAME}` directive as a first-class bake placeholder.

## Impact

- `@b-apm/core` `Mcp/bake.ts` (+ tests in `packages/core/tests/mcp/`)
- Install path already calls `bakeMcpServerMaps` — no new wire if regex covers the directive
- Docs: `apps/docs/guide/config-manifest.md`
- OpenSpec main `mcp-env-bake` after archive
