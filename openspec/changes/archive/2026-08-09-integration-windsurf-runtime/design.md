## Context

See proposal.md — Why. Cursor/Claude/Copilot already show the runtime package shape (`create*Integration`, helpers from `@b-apm/integration-api`, hooks ownership, `configureMcp`). APM `KNOWN_TARGETS["windsurf"]` uses `root_dir=".windsurf"`, `auto_create=False`, `detect_by_dir=True`, instructions → `.windsurf/rules/*.md` (`windsurf_rules`), commands → `.windsurf/workflows/*.md`, skills under `.agents/skills/` (`deploy_root=".agents"`), hooks merge `.windsurf/hooks.json` with `require_dir=True` and PascalCase events, **no agents primitive** (skills auto-invoke). MCP: home `~/.codeium/windsurf/mcp_config.json` via `WindsurfClientAdapter` (subclasses Copilot JSON `mcpServers`, bake-only env substitution). User-scope / `global_rules.md` are out of this change.

## Goals / Non-Goals

**Goals:**

- Greenfield `@b-apm/integration-windsurf` with project-scope file primitives + home MCP bake (client-adapter parity).
- Reuse integration-api helpers without inventing a second contract layer.
- Document object-map load: `targets: { windsurf: "@b-apm/integration-windsurf" }`.

**Non-Goals:**

- User-scope file deploy / `global_rules.md`.
- Agents materialize (APM N).
- Compile emitter, marketplace mapper.
- Changing empty-registry CLI composition or `mcpEnvMode` API (default bake suffices).

## Decisions

1. **Change / package naming**  
   OpenSpec change id: `integration-windsurf-runtime`. Capability id: `integration-windsurf-runtime`. Package: `@b-apm/integration-windsurf`.  
   _Alternative:_ shorter change `integration-windsurf` — rejected; parent/branch already use `-runtime` suffix.

2. **Default `deployRoots`: `[".windsurf", ".agents"]`**  
   Materialize asserts project writes under those roots; home MCP bypasses assert.  
   _Alternative:_ include `"."` — rejected (no project-root compile file in this change).

3. **Detect = `.windsurf/` directory only**  
   APM `detect_by_dir=True` on `root_dir=".windsurf"`. No mkdir on detect. Forced `--target windsurf` may mkdir on write.  
   _Alternative:_ also detect workflows/rules files without parent dir — rejected; dir signal is authoritative.

4. **Commands → workflows path**  
   Map bapm `command` to `.windsurf/workflows/<sanitize(name)>.md`. Never write `.windsurf/commands/`.  
   _Alternative:_ prompts-native Copilot path — rejected (APM windsurf uses workflows).

5. **Agents = skip with diagnostic**  
   Agent primitives MUST NOT write `.windsurf/agents/` or other agent trees. Emit a non-fatal diagnostic (e.g. `WINDSURF_AGENTS_UNSUPPORTED`) so install continues for other kinds.  
   _Alternative:_ collapse agents into skills — rejected (APM requires authors to ship skills, not silent remap).

6. **Hooks ownership = merge + sidecar (Cursor-like)**  
   Native file: `.windsurf/hooks.json` merge under `hooks` key. Scripts under `.windsurf/hooks/<sanitize(hookName)>/`. Ownership sidecar: `.windsurf/bapm-hooks.json`. Normalize event names to **PascalCase** on write (APM windsurf). Do not embed bapm-private keys inside host hook JSON.  
   _Alternative:_ Copilot per-file hooks — rejected (APM merge profile).  
   _Alternative:_ sidecar name `apm-hooks.json` — rejected; bapm hosts use `bapm-hooks.json`.

7. **MCP = home bake (client-adapter parity)**  
   Write/merge `~/.codeium/windsurf/mcp_config.json` → `mcpServers`. Resolve via `process.env.CODEIUM_HOME` when set (→ `<CODEIUM_HOME>/windsurf/mcp_config.json`), else `join(homedir(), ".codeium", "windsurf")`. Leave env placeholders already baked by install; do not declare `mcpEnvMode: "translate"`. Preserve unrelated servers. Report `configPath` as absolute or tilde form.  
   _Alternative:_ translate like Copilot — rejected (APM Windsurf adapter pins bake).  
   _Alternative:_ project MCP — deferred.

8. **Scaffolding**  
   Mirror `packages/integration-copilot` / cursor: `src/createWindsurfIntegration.ts`, `src/index.ts`, unit tests, `tests/acceptance/integration-windsurf-runtime/`, package.json workspace dep on integration-api only, vite-plus configs. Wire docs on `supported-hosts` + architecture index + object-map note.

9. **Helpers**  
   Prefer existing integration-api helpers; keep host-specific path/hooks/MCP logic inside the Windsurf package.

## Risks / Trade-offs

- [Home MCP outside deployRoots] → Mitigation: document home exception; report `configPath`; acceptance uses temp `CODEIUM_HOME` / home, never real user home.
- [Authors shipping only agents] → Mitigation: clear diagnostic; docs note skills-only for Windsurf.
- [PascalCase vs Cursor event casing] → Mitigation: explicit normalize in Windsurf hooks path; unit coverage.
- [Docs omit Windsurf] → Mitigation: tasks update supported-hosts / architecture.

## Migration Plan

1. Land package + tests + docs.
2. Users: `pnpm add -D @b-apm/integration-windsurf`, declare `targets.windsurf`, `bapm install --target windsurf`.
3. Rollback: remove map entry; delete generated `.windsurf/**` / `.agents/skills/**` / sidecar; manually edit `~/.codeium/windsurf/mcp_config.json` if needed.

## Open Questions

None blocking. Follow-up: thin `compile` for agents-family AGENTS.md; user-scope partial deploy excluding `global_rules`.
