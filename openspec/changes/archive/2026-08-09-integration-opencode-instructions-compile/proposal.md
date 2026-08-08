## Why

OpenCode already materializes skills/agents/commands and configures MCP, but instruction primitives never reach the host: materialize skips them and there is no `compile` path. APM’s OpenCode matrix expects project-root `AGENTS.md` as the compile-only channel for instructions; without it, OpenCode users cannot get the same guidance surface Cursor/Codex already share.

## What Changes

- Add OpenCode `compile()` that renders project-root `AGENTS.md` by default (basename-locked), **including** instruction primitives, with deterministic ordering and honor of write/validate (preview) intent.
- Keep instruction primitives out of native materialize host files (compile-only); optionally emit a non-fatal skip diagnostic for clarity, without failing install.
- Document OpenCode joining the Cursor/Codex `AGENTS.md` compile family (last-writer-wins per invocation).
- Preserve existing detect (`.opencode/` | `opencode.json` / `opencode.jsonc`), MCP `configureMcp`, skill/agent/command materialize under `.opencode/`, and hooks skip with `OPENCODE_HOOKS_UNSUPPORTED`.
- Keep skills under `.opencode/skills/` (do not migrate to APM `.agents/skills/` in this change).

**Non-goals:** user-scope `~/.config/opencode/`, enabling OpenCode hooks, changing MCP shapes, or re-routing skills to `.agents/skills/`.

## Capabilities

### New Capabilities

<!-- none — extends existing OpenCode runtime capability -->

### Modified Capabilities

- `integration-opencode-runtime`: add compile → `AGENTS.md` including instructions; clarify instruction materialize as compile-only (no native rules files).

## Impact

- Package: `packages/integration-opencode` (`createOpencodeIntegration` gains `compile`; README).
- Docs: `apps/docs` supported-hosts / architecture / compile reference note OpenCode in the `AGENTS.md` family.
- Specs: delta on `openspec/specs/integration-opencode-runtime`.
- Tests: acceptance suite for compile (and regression that detect/hooks/MCP stay intact), then promote into general package tests.
- No new runtime dependencies; `@bapm/integration-api` contracts only.
