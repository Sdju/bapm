## Why

`@bapm/integration-claude` is marketplace-output only today, so `bapm install --target claude` cannot detect Claude Code projects, materialize primitives under `.claude/`, configure project MCP, or compile `CLAUDE.md`. APM already defines a full Claude profile; bapm needs the matching runtime host next (per integration orchestration priority).

## What Changes

- Extend `@bapm/integration-claude` with a full `BapmIntegration` runtime (detect / materialize / optional `configureMcp` / preferred `compile` → `CLAUDE.md`) while **preserving** the existing Claude marketplace mapper and pack path.
- Materialize APM-aligned layouts under `.claude/`: skills (native `.claude/skills/`, not `.agents/skills/`), instructions (`.claude/rules/` with `applyTo` → `paths`), agents, commands, hooks (merge `.claude/settings.json` + scripts under `.claude/hooks/`).
- Project-scope MCP via root `.mcp.json` (`mcpServers`), opt-in when `.claude/` exists; no user-scope / `CLAUDE_CONFIG_DIR` / local `projects.*` scope in this change.
- Document Claude as an opt-in **runtime** host (plus existing marketplace pack); keep CLI empty-registry / object-map load unchanged.
- Package/unit tests covering detect, materialize kinds, hooks ownership, MCP opt-in, and compile.

**Non-goals:** codex/copilot/other new hosts; OpenCode instructions/compile/hooks fill; canvas; user-scope MCP / `CLAUDE_CONFIG_DIR` (beyond minimal mention); full APM cross-host hook-IR dialect.

## Capabilities

### New Capabilities

- `integration-claude-runtime`: Claude Code runtime on `@bapm/integration-claude` — detect signals, `.claude/` materialize paths, hooks merge + ownership sidecar, project `.mcp.json` configure, optional `CLAUDE.md` compile, marketplace mapper retained.

### Modified Capabilities

- `compile-agents-md`: Allow Claude-host compile emission of `CLAUDE.md` when the Claude integration exposes `compile`; keep the M9 “no foreign-host artifacts from cursor-default compile” intent intact.
- `marketplace-pack-outputs`: Clarify that `@bapm/integration-claude` MAY expose runtime capabilities in addition to marketplace-output (no longer marketplace-only forever).

## Impact

- Package: `packages/integration-claude` (exports factory + existing marketplace API).
- Docs: `supported-hosts`, architecture index, marketplace-pack situations that currently say Claude is not runtime.
- CLI load already accepts `createIntegration`; no eager registration.
- Tests in the Claude package (+ light docs/compat updates as needed).
- Consumers of marketplace-only shims remain valid if marketplace exports stay.
