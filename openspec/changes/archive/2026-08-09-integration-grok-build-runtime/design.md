## Context

See proposal.md — Why. Cursor/Claude/Codex/OpenCode/Copilot already show the runtime package shape (`create*Integration`, helpers from `@bapm/integration-api`, optional `compile`). APM `KNOWN_TARGETS["grok-build"]` uses `root_dir=".grok"`, `auto_create=False`, detect signal **only** `.grok/`, instructions as `.grok/rules/*.md` (`grok_rules` identity), agents `.grok/agents/*.md`, commands `.grok/commands/*.md` (`claude_command`), skills `.grok/skills/<n>/SKILL.md`, no hooks/MCP, compile family `agents` → project `AGENTS.md`. Experimental `grok-cloud` is out of scope.

## Goals / Non-Goals

**Goals:**

- New greenfield package owning Grok Build project-scope runtime.
- Mirror Claude/OpenCode helper patterns from `@bapm/integration-api`, with Grok-native paths under `.grok/`.
- Explicit skip diagnostics for hooks/prompts; omit `configureMcp`.

**Non-Goals:**

- User-scope writes (`~/.grok/**`).
- Experimental `grok-cloud` target / experimental flag surface.
- Hooks JSON, prompts writers, or MCP adapters.
- Full APM AGENTS.md richness (distributed files, constitution, managed-section markers).
- Changing CLI eager registration.

## Decisions

1. **New package `@bapm/integration-grok-build`**  
   No marketplace skeleton exists; greenfield package with `createGrokBuildIntegration` / `createIntegration`.  
   _Alternative:_ fold into another package — rejected (wrong host id / deploy roots).

2. **Default `deployRoots`: `[".grok", "."]`**  
   Materialize under `.grok/**`. Compile default `AGENTS.md` at repo root, so `"."` is registered with a **hard basename allowlist** (`AGENTS.md` only for compile; never arbitrary root writes from materialize).  
   _Alternative:_ omit `"."` and special-case compile outside `assertUnderDeployRoots` — rejected; prefer explicit root + allowlist like Claude/Codex.

3. **Detect: `.grok/` directory only**  
   Match APM `(".grok")`. Lone `AGENTS.md` MUST NOT activate Grok Build (shared with Cursor/Codex compile family). Detection MUST NOT mkdir.  
   _Alternative:_ also detect `AGENTS.md` — rejected (false positives).

4. **Skills → `.grok/skills/<name>/`**  
   Match APM matrix: Claude/Grok keep target-native skill directories (not `.agents/skills/` convergence). Portable Agent Plugins skill directories copy into that destination.  
   _Alternative:_ write `.agents/skills/` — rejected (APM matrix for grok-build).

5. **Instructions → `.grok/rules/<name>.md` (identity)**  
   APM `grok_rules` is not in RULE_FORMATS / has no `output_compare`; copy content verbatim (no `applyTo`→`paths` remap required).  
   _Alternative:_ reuse Claude `paths:` transform — rejected (APM identity).

6. **Agents → `.grok/agents/<name>.md` (copy)**  
   Match APM `grok_agent` copy path (markdown, not TOML).  
   _Alternative:_ invent TOML agents — rejected.

7. **Commands → `.grok/commands/<name>.md` with Claude-subset FM**  
   Reuse shared `claude_command` preserved keys; drop others with diagnostic (codes prefixed `GROK_BUILD_`).  
   _Alternative:_ verbatim copy without FM filter — rejected (APM uses `claude_command`).

8. **Hooks / prompts: skip with diagnostics**  
   Non-fatal codes e.g. `GROK_BUILD_HOOKS_UNSUPPORTED` / `GROK_BUILD_PROMPTS_UNSUPPORTED`. No hooks JSON/scripts writers.  
   _Alternative:_ invent hooks support — rejected (APM N).

9. **No `configureMcp`**  
   Omit the optional hook entirely so install MCP path skips this host.  
   _Alternative:_ stub that always diagnostics — rejected (cleaner contract: absent hook).

10. **Forced target / missing `.grok/`: mkdir-on-write for materialize**  
    When grok-build is actively invoked (forced `--target grok-build` or materialize after registration), writers MAY `mkdir` `.grok/` as needed. Auto-detect MUST still require existing `.grok/`.  
    _Alternative:_ skip when missing — rejected for forced `--target` empty projects.

11. **`compile()` → `AGENTS.md` (agents family)**  
    Thin host render (deterministic order), default path `AGENTS.md`, honor `CompileContext.write`. Include discoverable primitives (Cursor-style thin agents emitter). Shared collision with Cursor/Codex: last writer wins; no merge.  
    _Alternative:_ omit instructions because rules exist — deferred (Cursor-family hosts include; keep thin emitter simple).

12. **CLI load**  
    Prefer `createIntegration` (already first in `loadIntegrationFromPackage`). No CLI composition changes beyond docs/examples.

## Risks / Trade-offs

- [Root `.` in deployRoots widens write surface] → Mitigation: materialize never writes outside `.grok/`; compile hard-codes basename allowlist for `AGENTS.md`.
- [Cursor/Codex/Grok all compile AGENTS.md] → Mitigation: document last-writer; prefer one active compile target.
- [Confusion with experimental grok-cloud] → Mitigation: docs explicitly out-of-scope; package id is `grok-build` only.
- [APM identity rules vs Claude paths transform] → Mitigation: keep verbatim; document difference.

## Migration Plan

1. Land package + tests; document object-map `targets: { grok-build: "@bapm/integration-grok-build" }`.
2. Users: install package, declare targets, `bapm install` / optional `bapm compile`.
3. Rollback: remove map entry; delete generated `.grok/**` and project `AGENTS.md` manually if desired.

## Open Questions

None blocking; user-scope and grok-cloud deferred by design.
