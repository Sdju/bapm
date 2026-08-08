## Context

See proposal.md — Why. Today `@bapm/integration-claude` exports only `claudeMarketplaceIntegration` / `mapClaudeMarketplace`. Cursor/OpenCode already show the runtime package shape (`create*Integration`, `primitivesMaterialize`, `configureMcp`, optional `compile`). APM `KNOWN_TARGETS["claude"]` uses root `.claude/`, native skills under `.claude/skills/`, hooks merge into `.claude/settings.json`, project MCP at `.mcp.json` when `.claude/` exists, detect via `.claude/` or `CLAUDE.md`, `auto_create=False`, compile → `CLAUDE.md` with rules-dedup.

## Goals / Non-Goals

**Goals:**

- One package owns both marketplace pack mapping and Claude Code runtime without splitting packages.
- Mirror Cursor materialize/hooks/MCP patterns and helpers from `@bapm/integration-api`, with Claude-native paths (especially skills not under `.agents/skills/`).
- Decide hooks ownership so reinstall is idempotent without polluting Claude’s native settings schema.

**Non-Goals:**

- User-scope writes (`CLAUDE_CONFIG_DIR`, `~/.claude.json`, user `CLAUDE.md`).
- Local Claude MCP scope (`projects.<abs_path>.mcpServers`).
- Full APM hook-IR cross-host translation; only Claude-native merge of package hook JSON + script copy.
- Changing CLI eager registration or inventing a second package id.

## Decisions

1. **Extend `@bapm/integration-claude` (not a new package)**  
   Knowledge priority and skeleton already exist; keep marketplace mapper exports and add `createClaudeIntegration` / `createIntegration`.  
   _Alternative:_ new `@bapm/integration-claude-code` — rejected (duplicate token/`targets.claude` confusion).

2. **Default `deployRoots`: `[".claude", "."]`**  
   Materialize stays under `.claude/**`. Project MCP and optional compile output live at repo root (`.mcp.json`, `CLAUDE.md`), so `"."` is registered like OpenCode’s `opencode.json` case. Writers MUST hard-limit root writes to those known relative files (never arbitrary paths under `.`).  
   _Alternative:_ only `.claude` and special-case MCP outside `assertUnderDeployRoots` — rejected; prefer explicit root + tight basename allowlist.

3. **Skills native `.claude/skills/<name>/`**  
   Match APM (Claude is the non-converged skills host). Portable Agent Plugins skill directories copy into that destination; MCP command rewrite of `.agents/skills/` → `.claude/skills/` when configuring Claude MCP (APM `ClaudeClientAdapter` behavior) is in scope for `configureMcp`.  
   _Alternative:_ also write `.agents/skills/` — rejected for v1 to avoid dual trees and Cursor collision.

4. **Instructions: `applyTo` → `paths` on `.claude/rules/<name>.md`**  
   Follow APM `_convert_to_claude_rules`: path-scoped rules get YAML `paths:` list; unconditional instructions omit frontmatter. Extension `.md` (not `.mdc`).

5. **Commands: shared `claude_command` frontmatter subset**  
   Preserve the same common keys Cursor already keeps (`description`, `allowed-tools`, `model`, `argument-hint`, `input`); drop others with diagnostics. Destination `.claude/commands/<name>.md`.

6. **Hooks ownership sidecar: `.claude/bapm-hooks.json`**  
   Merge hook events into `.claude/settings.json` (preserve unrelated settings keys); copy scripts under `.claude/hooks/<name>/`. Ownership mirrors Cursor’s `.cursor/bapm-hooks.json` so reinstall can strip previously owned entries without relying on lock-only reconciliation in the host package. Native settings MUST remain free of `_apm_source` / bapm-private keys.  
   _Alternative:_ lock-only ownership — rejected for host-package idempotence parity with Cursor in this change.

7. **MCP: project `.mcp.json`, opt-in on `.claude/` directory**  
   Write/merge top-level `mcpServers`; shallow-merge per server; normalize stdio to `type: "stdio"` and drop Copilot-only noise when present. If `.claude/` is absent, skip write with a diagnostic (forced materialize may create `.claude/` first; configureMcp still requires directory presence for project scope). No user-scope path.  
   _Alternative:_ always create `.mcp.json` without `.claude/` — rejected (APM opt-in).

8. **Detect: `.claude/` directory OR `CLAUDE.md` file**  
   Do not mkdir solely to satisfy detect (`auto_create=False` spirit). Forced `--target claude` may create registered roots during materialize.

9. **`compile()` → `CLAUDE.md` (included in this change)**  
   Host-owned compile like Cursor’s `AGENTS.md`. Default output `CLAUDE.md`. Omit instruction primitives from the compiled body (they belong under `.claude/rules/` via materialize) to avoid duplicate context. Deterministic ordering. Honor `CompileContext.write`.  
   _Alternative:_ defer compile — rejected; fits the same change and unblocks Claude compile selection.

10. **Dual export surface**  
    Keep `claudeMarketplaceIntegration` for pack; add runtime factory. Do not remove marketplace-only selection independence. Runtime object MAY omit marketplace fields; pack continues to load marketplace capability separately.

11. **CLI load**  
    Prefer `createIntegration` (already first in `loadIntegrationFromPackage`). No CLI composition changes required beyond docs/examples.

## Risks / Trade-offs

- [Root `.` in deployRoots widens write surface] → Mitigation: materialize never writes outside `.claude/`; MCP/compile hard-code `.mcp.json` / `CLAUDE.md` basenames.
- [Dual Cursor + Claude skills] → Mitigation: separate skill trees; users choose via `targets` / `--target`.
- [settings.json shared with user hooks] → Mitigation: sidecar strip/replace of owned entries only; preserve unrelated keys and non-owned hook handlers.
- [Docs still say Claude is marketplace-only] → Mitigation: update supported-hosts / situations in tasks.
- [compile-agents-md M9 wording forbids CLAUDE.md] → Mitigation: delta allows Claude-target compile while cursor-default still MUST NOT emit foreign artifacts.

## Migration Plan

1. Land runtime + tests in `@bapm/integration-claude`; marketplace tests keep passing.
2. Users: ensure `@bapm/integration-claude` installed, `targets.claude` (or `--target claude`), `bapm install`, optional `bapm compile` when Claude is active.
3. Rollback: remove map entry / stop using factory; delete generated `.claude/**`, owned settings hooks, `.mcp.json` servers, and `CLAUDE.md` manually if desired. Marketplace pack path remains.

## Open Questions

None blocking; user-scope MCP/`CLAUDE_CONFIG_DIR` deferred by design.
