## Context

See proposal.md — Why. APM `KNOWN_TARGETS["antigravity"]` uses shared `root_dir=".agents"`, `detect_by_dir=False`, explicit-only (not in `--target all`), instructions → `.agents/rules/` with trigger/globs, skills → `.agents/skills/`, hooks → `.agents/hooks.json` (agy schema), MCP → `.agents/mcp_config.json` (opt-in dir), compile family `agents` with rules dedup. User-scope `~/.gemini/**` is out of scope for this change. Sibling packages (cursor/claude/codex/copilot/opencode) already show the runtime package shape.

## Goals / Non-Goals

**Goals:**

- Greenfield `@bapm/integration-antigravity` with project-scope file primitives + opt-in project MCP (parity APM antigravity project surface minus user scope).
- Reuse integration-api helpers without inventing a second contract layer.
- Document object-map load: `targets: { antigravity: "@bapm/integration-antigravity" }`.

**Non-Goals:**

- Auto-detect; `--target all` inclusion; `~/.gemini/**`; agents/commands writers; GEMINI.md; marketplace mapper; rich APM compile; agent-skills package ownership of other `.agents/` trees.

## Decisions

1. **Change / package naming**  
   OpenSpec change id: `integration-antigravity-runtime`. Capability id: `integration-antigravity-runtime`. Package: `@bapm/integration-antigravity`.  
   Branch: `orch/integration-antigravity-runtime`.

2. **Default `deployRoots`: `[".agents", "."]`**  
   Compile default path is project-root `AGENTS.md`, so `"."` is registered for containment like Codex. All materialize/MCP project writes stay under `.agents/`.  
   _Alternative:_ only `.agents` — rejected (compile path jail).

3. **Detect always false**  
   Shared `.agents/` belongs to multiple hosts (agent-skills, skills convergence). Antigravity never auto-detects; forced target activates writers.  
   _Alternative:_ detect `.agents/hooks.json` or `mcp_config.json` — rejected (APM explicit-only model; false positives with other tools).

4. **Instructions → rules with trigger/globs**  
   Map `applyTo` CSV/string → `trigger: glob` + `globs` (scalar or YAML list). Strip/replace portable instruction FM that Antigravity does not use. Body preserved. Destination `.agents/rules/<sanitize(name)>.md`.

5. **Hooks ownership = bapm container + sidecar**  
   Merge owned events under a reserved top-level name `bapm` inside `.agents/hooks.json` (APM uses `apm`; bapm uses `bapm`). Scripts under `.agents/hooks/<pkg>/…`. Sidecar `.agents/bapm-hooks.json` lists owned relative paths for cleanup. Preserve sibling user hook-name containers. Preserve agy nested vs flat event shapes; `timeout` in seconds.  
   _Alternative:_ embed `_bapm_source` on handlers — rejected for host-facing cleanliness; sidecar is enough.

6. **MCP = project opt-in only**  
   Write/merge `.agents/mcp_config.json` → `mcpServers` when `.agents/` directory exists; otherwise skip + diagnostic. Map remote URL fields to `serverUrl`. No `~/.gemini/config/mcp_config.json`. Prefer bake-compatible env (default) unless translate is later justified.  
   _Alternative:_ also user-scope — rejected (proposal Out).

7. **Thin compile omits instruction kind**  
   Same attributed-set omit as Claude/Copilot rules-dedup: drop `instruction` primitives from `AGENTS.md` body because they materialize to `.agents/rules/`. Keep other kinds (if any) deterministically ordered. Honor `CompileContext.write`.

8. **Agents/commands skip**  
   Non-fatal diagnostics; no directory fabrication for those kinds.

9. **Scaffolding**  
   Mirror `packages/integration-opencode` / copilot: `src/createAntigravityIntegration.ts`, `src/index.ts`, tests, vite-plus configs, docs updates on supported-hosts + architecture.

10. **Overlap with agent-skills**  
    Only write `.agents/rules/`, `.agents/skills/`, `.agents/hooks.json`, `.agents/hooks/**` scripts, `.agents/bapm-hooks.json`, `.agents/mcp_config.json`. Do not claim marketplace/plugin trees or other shared subtrees.

## Risks / Trade-offs

- [Shared `.agents/` collisions with agent-skills / Cursor skills] → Mitigation: explicit-only activation; narrow write set; document coexistence.
- [agy hooks schema complexity] → Mitigation: follow APM nested vs flat event lists; acceptance fixtures lock shapes.
- [MCP opt-in vs forced materialize mkdir] → Mitigation: materialize may create `.agents/`; configureMcp still checks directory presence at call time (install order: materialize before MCP when both run).

## Migration Plan

1. Land package + tests + docs.
2. Users: `pnpm add -D @bapm/integration-antigravity`, declare `targets.antigravity`, `bapm install --target antigravity`, optional `bapm compile`.
3. Rollback: remove map entry; delete generated `.agents/rules|skills|hooks*|mcp_config.json` / sidecar / `AGENTS.md` as needed.

## Open Questions

None blocking. Alias `agy` normalization is CLI/core territory if not already present; package id remains `antigravity`.
