## Why

Canonical OpenAPM target id `opencode` is already accepted in the manifest, and users run OpenCode locally, but bapm has no `@bapm/integration-opencode` package. Without it, `bapm install --target opencode` cannot register a host, materialize skills/agents, or adapt portable Agent Plugins MCP into OpenCode’s config — so starting `opencode` never sees bapm-managed packages.

## What Changes

- Add opt-in runtime package `@bapm/integration-opencode` (`packages/integration-opencode`) implementing detect / materialize / optional `configureMcp` via `@bapm/integration-api`, parallel to Cursor.
- Materialize skills under `.opencode/skills/<name>/` (including portable Agent Plugins skill directories), agents under `.opencode/agents/<name>.md`, with writes bounded to registered deploy roots.
- Adapt portable / host-agnostic MCP into project `opencode.json` `mcp` entries (OpenCode local/remote shape), without copying portable metadata verbatim.
- Document OpenCode as a supported opt-in host; extend Agent Plugins target-MCP guidance so OpenCode is an explicit adapter (not Cursor-only).
- Wire docs / init examples so `targets: { opencode: "@bapm/integration-opencode" }` + `bapm install --target opencode` is the supported activation path (CLI already maps `--target <id>` → `@bapm/integration-<id>`).

## Capabilities

### New Capabilities

- `integration-opencode-runtime`: OpenCode host package — detect signals, skill/agent materialize under `.opencode/`, MCP merge into `opencode.json`, Agent Plugins portable adaptation, package boundary (no core hard-dep).

### Modified Capabilities

- `agent-plugins-compatibility`: Document and require OpenCode as an adapter for portable MCP/skills (alongside Cursor), including transport mapping and e2e regression expectation when OpenCode is active.

## Impact

- New workspace package `packages/integration-opencode`; vite-plus / TypeScript like other `@bapm/integration-*`.
- Docs: `supported-hosts`, `agent-plugins`, architecture index; optional compatibility matrix / cases when OpenCode e2e is added.
- No change to CLI eager registration (stays empty; object-map load only).
- Non-goals: OpenCode npm `plugin` array / JS plugin install; marketplace-output for OpenCode; V2-only `mcp.servers` schema; instruction→rules parity with Cursor; global `~/.config/opencode` writes; APM in-tree adapter parity.
