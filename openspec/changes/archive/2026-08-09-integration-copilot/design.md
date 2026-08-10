## Context

See proposal.md — Why. Cursor/Claude/Codex/OpenCode already show the runtime package shape (`create*Integration`, helpers from `@b-apm/integration-api`, hooks ownership, `configureMcp`, optional `compile`). APM `KNOWN_TARGETS["copilot"]` uses `root_dir=".github"`, prompts-native (no commands mapping), skills under `.agents/skills/`, per-file hooks, MCP at `~/.copilot/mcp-config.json` with translate-mode placeholders, compile → `.github/copilot-instructions.md`. Today install always runs `bakeMcpServerMaps` before every `configureMcp`, which would break Copilot translate parity unless dispatch is host-policy-aware.

## Goals / Non-Goals

**Goals:**

- Greenfield `@b-apm/integration-copilot` with project-scope file primitives + home MCP translate (parity A).
- Reuse integration-api helpers (`primitivesList`, `sanitizeName`, `assertUnderDeployRoots`, `readPrimitiveContent`, skill directory copy patterns) without inventing a second contract layer.
- Document object-map load: `targets: { copilot: "@b-apm/integration-copilot" }` (CLI already maps `--target <id>` → package when declared).

**Non-Goals:**

- Canvas, user-scope file deploy, vscode `.vscode/mcp.json`, marketplace mapper, rich compile, cowork/app.
- Full APM hook payload validation surface beyond what Cursor/Claude loops already reuse.
- Changing empty-registry CLI composition (no eager register).

## Decisions

1. **Change / package naming**  
   OpenSpec change id: `integration-copilot`. Capability id: `integration-copilot-runtime` (matches sibling `integration-*-runtime` specs). Package: `@b-apm/integration-copilot` (greenfield; no marketplace dual-surface).  
   _Alternative:_ change folder `integration-copilot-runtime` — rejected; shorter change name is enough when capability carries `-runtime`.

2. **Default `deployRoots`: `[".github", ".agents"]`**  
   Compile default path is under `.github/` (`copilot-instructions.md`), so root `"."` is **not** required. Materialize asserts project writes under those two roots; home MCP bypasses assert.  
   _Alternative:_ add `"."` for symmetry with Claude — rejected (no project-root compile file).

3. **Detect = APM SIGNAL_WHITELIST (OR)**  
   Any one of: `.github/copilot-instructions.md` (file), `.github/instructions|agents|prompts|hooks/` (dirs). No mkdir on detect. Forced `--target copilot` may mkdir on write.  
   _Alternative:_ detect only `copilot-instructions.md` (docs one-liner) — rejected; whitelist is authoritative.

4. **Commands → prompts-native path**  
   Map bapm discovery type `command` (and `*.prompt.md` sources) to `.github/prompts/<sanitize(name)>.prompt.md`. Never write `.github/commands/`.  
   _Alternative:_ also accept explicit `prompt` type if discovery emits it — optional alias in implementer if present; primary contract is `command` → prompts.

5. **Hooks ownership = APM-like tracked filenames + sidecar**  
   Native files: `.github/hooks/<sanitize(pkg)>-<sanitize(stem)>.json` + scripts under `.github/hooks/scripts/<sanitize(pkg)>/`. Ownership sidecar: `.github/bapm-hooks.json` listing owned relative paths (hook JSON + scripts) for idempotent cleanup — same spirit as Cursor/Claude sidecars, adapted to per-file (not merge) layout. Do **not** embed bapm-private keys inside host hook JSON. Normalize event names to **camelCase** on write.  
   _Alternative:_ filename convention only, no sidecar — rejected (script orphans / rename churn harder to clean).  
   _Alternative:_ Cursor-style single merged hooks.json — rejected (APM Copilot is per-file).

6. **MCP = home translate (parity A)**  
   Write/merge `~/.copilot/mcp-config.json` → `mcpServers`. Resolve home via `process.env.COPILOT_HOME` when set, else `join(homedir(), ".copilot")`. Translate APM placeholders to `${VAR}` without reading secrets from `process.env` for those tokens. Preserve unrelated servers. Report `configPath` as absolute or `~/.copilot/mcp-config.json`.  
   _Alternative:_ strict project-only defer MCP — rejected (APM matrix mcp:S; incomplete host).  
   _Alternative:_ also write `.vscode/mcp.json` — deferred to separate vscode host.

7. **Install bake dispatch via `mcpEnvMode`**  
   Add optional `mcpEnvMode?: "bake" | "translate"` on `BapmIntegration` (integration-api). Copilot sets `"translate"`. Install: for each active target, bake APM placeholders only when mode ≠ `translate` (missing ⇒ bake). Still resolve `{bake:NAME}` globally or per-target before configure (fail closed). No host-id allowlists in core.  
   _Alternative:_ hardcode `targetId === "copilot"` — rejected (architecture / future Kiro).

8. **Thin compile omits already-deployed instructions**  
   Default output `.github/copilot-instructions.md`. Filter out primitives with type matching instruction that materialize already places under `.github/instructions/`. Keep deterministic ordering for remaining sections (Claude-like thin emitter). Honor `CompileContext.write`.  
   _Alternative:_ include all instructions in compile (Codex-style) — rejected (duplicate Copilot context with native instructions dir).  
   _Alternative:_ omit only when files exist on disk — prefer omit by kind for the same attributed set (simpler, matches Claude rules omit).

9. **Scaffolding**  
   Mirror `packages/integration-opencode` / claude: `src/createCopilotIntegration.ts`, `src/index.ts`, `tests/`, `tests/acceptance/integration-copilot-runtime/`, `package.json` workspace dep on integration-api only, vite-plus configs. Wire docs on `supported-hosts` + architecture index + object-map note.

10. **Helpers**  
    Prefer existing integration-api helpers; keep host-specific path/FM/hooks/MCP logic inside the Copilot package (no core adapters).

## Risks / Trade-offs

- [Home MCP outside deployRoots / lock path assumptions] → Mitigation: document home exception; report absolute/tilde `configPath`; extend api contract text for non-project paths.
- [Global bake today breaks translate] → Mitigation: `mcpEnvMode` + per-target bake skip in install (required apply task).
- [COPILOT_HOME / multi-user CI] → Mitigation: honor `COPILOT_HOME`; acceptance tests use temp home / env override, never real user home.
- [Per-file hooks vs merge hosts] → Mitigation: shared camelCase + sidecar patterns; no fake merge file.
- [Docs still omit Copilot] → Mitigation: tasks update supported-hosts / architecture.

## Migration Plan

1. Land package + api `mcpEnvMode` + install bake dispatch + tests.
2. Users: `pnpm add -D @b-apm/integration-copilot`, declare `targets.copilot`, `bapm install --target copilot`, optional `bapm compile`.
3. Rollback: remove map entry; delete generated `.github/**` / `.agents/skills/**` / sidecar; manually edit `~/.copilot/mcp-config.json` if needed.

## Open Questions

None blocking. Follow-up: thin `vscode` MCP-only integration vs opt-in `.vscode/mcp.json` inside this package — deferred.
