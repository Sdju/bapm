## Why

`@b-apm/integration-codex` is marketplace-output only today, so `bapm install --target codex` cannot detect Codex projects, materialize agents/skills/hooks, configure MCP in `.codex/config.toml`, or compile project `AGENTS.md` with compile-only instructions. APM already defines a full Codex profile; bapm needs the matching project-scope runtime host next (per integration orchestration priority / knowledge topic).

## What Changes

- Extend `@b-apm/integration-codex` with a full `BapmIntegration` runtime (`createCodexIntegration` / `createIntegration`: detect / materialize / `configureMcp` / `compile`) while **preserving** `mapCodexMarketplace` and `.agents/plugins/marketplace.json` pack mapping.
- Detect **only** when `.codex/` is a directory (do **not** treat lone `AGENTS.md` as Codex).
- Materialize APM-aligned project layouts: skills → `.agents/skills/`; agents → `.codex/agents/<name>.toml` (MD frontmatter → TOML; drop `tools` + diagnostic); hooks → merge `.codex/hooks.json` + scripts + ownership sidecar; instruction/command/prompt → **skip** native files (non-fatal diagnostics).
- Project MCP via `.codex/config.toml` section `mcp_servers` (TOML); reject SSE with diagnostic; stdio + https streamable-http allowed.
- Host `compile` → thin project `AGENTS.md` that **includes** instruction primitives (compile-only path; opposite of Claude rules-dedup omit).
- Document Codex as an opt-in **runtime** host (plus existing marketplace pack); keep CLI empty-registry / object-map load unchanged.
- Package/unit + acceptance-oriented tests covering detect, materialize kinds, hooks ownership, MCP, compile-with-instructions, marketplace retention.

**Non-goals:** `CODEX_HOME` / user-scope (`~/.codex/**`, user `AGENTS.md`); native instructions/commands/prompts writers; rich APM AGENTS.md (distributed, constitution, managed sections); other hosts; `CodexRuntime` prompt execution; marketplace JSON schema changes beyond retaining the current mapper.

## Capabilities

### New Capabilities

- `integration-codex-runtime`: Codex CLI runtime on `@b-apm/integration-codex` — detect `.codex/` only, materialize paths (skills under `.agents/`, agents/hooks under `.codex/`), MCP `mcp_servers` in `config.toml`, compile `AGENTS.md` including instructions, marketplace mapper retained.

### Modified Capabilities

- `compile-agents-md`: Allow Codex-host compile emission of shared-family `AGENTS.md` when the Codex integration exposes `compile`; keep cursor-default “no foreign-host side effects” intent; document shared-path collision with Cursor.
- `marketplace-pack-outputs`: Clarify that `@b-apm/integration-codex` MAY expose runtime capabilities in addition to marketplace-output (no longer permanently marketplace-only).

## Impact

- Package: `packages/integration-codex` (exports factory + existing marketplace API; likely TOML parse/serialize dependency via catalog).
- Docs: `supported-hosts`, architecture index, marketplace-pack situations that currently say Codex is marketplace-only.
- CLI load already accepts `createIntegration`; no eager registration.
- Tests in the Codex package (+ light docs/compat updates as needed).
- Consumers of marketplace-only shims remain valid if marketplace exports stay.
