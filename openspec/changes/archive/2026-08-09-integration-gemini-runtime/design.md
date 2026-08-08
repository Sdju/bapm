## Context

See proposal.md — Why. Cursor/Claude/Codex/Copilot already show the runtime package shape. APM `KNOWN_TARGETS["gemini"]` uses `root_dir=".gemini"`, commands as `.toml` (`gemini_command`), skills under `.agents/skills/`, hooks merged into `.gemini/settings.json`, MCP via `GeminiClientAdapter` into the same settings file, and compile family `gemini` → `GEMINI.md`. Instructions are compile-only (no `.gemini/rules/`). This change ports project-scope parity; user-scope and rich distributed compile stay out.

## Goals / Non-Goals

**Goals:**

- Greenfield `@bapm/integration-gemini` with project-scope file primitives + project MCP (parity with APM project install).
- Reuse integration-api helpers without inventing a second contract layer.
- Document object-map load: `targets: { gemini: "@bapm/integration-gemini" }`.

**Non-Goals:**

- User-scope (`~/.gemini/settings.json`, `~/.gemini/GEMINI.md`).
- Rich APM distributed compile / `GEMINI.md` stub importing `AGENTS.md`.
- Marketplace mapper, canvas, Antigravity.
- Changing empty-registry CLI composition.

## Decisions

1. **Change / package naming**  
   OpenSpec change id: `integration-gemini-runtime`. Capability: `integration-gemini-runtime`. Package: `@bapm/integration-gemini`.

2. **Default `deployRoots`: `[".gemini", ".agents", "."]`**  
   Commands/hooks under `.gemini/`, skills under `.agents/`, compile `GEMINI.md` at project root needs `.`.

3. **Detect = `.gemini/` OR `GEMINI.md`**  
   Broader than APM `detect_by_dir` alone; matches Claude’s `CLAUDE.md` pattern and user scope. No mkdir on detect.

4. **Commands → TOML via catalog `smol-toml`**  
   Same dependency pattern as Codex agents. Transform markdown/prompt sources: body → `prompt`, optional `description`, `$ARGUMENTS` → `{{args}}`.

5. **Hooks = Claude-like merge + Gemini event remap**  
   Merge into `.gemini/settings.json` `hooks`, scripts under `.gemini/hooks/<name>/`, ownership `.gemini/bapm-hooks.json`. Remap PreToolUse→BeforeTool, PostToolUse→AfterTool, Stop→SessionEnd. Do not embed `_apm_source` / bapm-private keys in host JSON.

6. **MCP = project settings.json, bake default, Gemini schema**  
   Opt-in when `.gemini/` exists (skip + diagnostic otherwise). Write `mcpServers` without required `type`; map http/streamable-http → `httpUrl`, sse → `url`. Preserve hooks and unrelated servers. No `mcpEnvMode: "translate"` (APM Gemini still bake/resolve at install).

7. **Compile = thin instruction-only `GEMINI.md`**  
   Filter to instruction-typed primitives; deterministic order; honor `CompileContext.write`. Reject rich distributed / user-scope compile in this package.

8. **Scaffolding**  
   Mirror `packages/integration-codex` / claude: `createGeminiIntegration.ts`, `index.ts`, tests, acceptance dir, vite-plus configs, docs on `supported-hosts`.

## Risks / Trade-offs

- [Gemini nested hook schema vs Claude-flat entries] → Mitigation: remap events + preserve entry objects Claude-style; full nested IR can follow later.
- [MCP opt-in vs forced target] → Mitigation: materialize may create `.gemini/` first; configure runs after and finds the dir.
- [TOML edge cases] → Mitigation: reuse `smol-toml`; keep fields to description/prompt only.

## Migration Plan

1. Land package + tests + docs.
2. Users: install `@bapm/integration-gemini`, declare `targets.gemini`, `bapm install --target gemini`, optional `bapm compile`.
3. Rollback: remove map entry; delete generated `.gemini/**` / `.agents/skills/**` / `GEMINI.md` / sidecar as needed.

## Open Questions

None blocking.
