## Context

See proposal.md — Why. Today `@b-apm/integration-codex` exports only `codexMarketplaceIntegration` / `mapCodexMarketplace`. Cursor/Claude/OpenCode already show the runtime package shape (`create*Integration`, `primitivesMaterialize`, hooks sidecar, `configureMcp`, `compile`). APM `KNOWN_TARGETS["codex"]` uses `root_dir=".codex"`, `auto_create=False`, detect signal **only** `.codex/`, skills under `.agents/skills/`, agents as `.codex/agents/<n>.toml`, hooks merge `.codex/hooks.json` with `require_dir=True`, MCP at `.codex/config.toml` `mcp_servers`, compile family `agents` → project `AGENTS.md` with instructions rolled in (no native rules files).

## Goals / Non-Goals

**Goals:**

- One package owns both marketplace pack mapping and Codex CLI project-scope runtime without splitting packages.
- Mirror Cursor/Claude helper patterns from `@b-apm/integration-api`, with Codex-native paths (skills converged under `.agents/skills/`; agents TOML under `.codex/`).
- Resolve forced-target missing-`.codex/` policy for hooks **and** MCP consistently; document shared `AGENTS.md` collision with Cursor.

**Non-Goals:**

- User-scope writes (`CODEX_HOME`, `~/.codex/**`, user `AGENTS.md`).
- Native instruction/command/prompt file writers.
- Full APM AGENTS.md richness (distributed files, constitution, managed-section markers, context optimizer).
- Full cross-host hook-IR dialect; only Codex-native merge of package hook JSON + script copy + ownership sidecar.
- Changing CLI eager registration or inventing a second package id / marketplace schema break.

## Decisions

1. **Extend `@b-apm/integration-codex` (not a new package)**  
   Knowledge priority and marketplace skeleton already exist; keep marketplace mapper exports and add `createCodexIntegration` / `createIntegration`.  
   _Alternative:_ new `@b-apm/integration-codex-cli` — rejected (duplicate token / `targets.codex` confusion).

2. **Default `deployRoots`: `[".codex", ".agents", "."]`**  
   Materialize skills under `.agents/skills/**`; agents/hooks/MCP under `.codex/**`. Compile default `AGENTS.md` at repo root, so `"."` is registered with a **hard basename allowlist** (`AGENTS.md` only for compile; never arbitrary root writes from materialize).  
   _Alternative:_ omit `"."` and special-case compile outside `assertUnderDeployRoots` — rejected; prefer explicit root + allowlist like Claude/OpenCode.

3. **Detect: `.codex/` directory only**  
   Match APM `SIGNAL_WHITELIST` / `(".codex")`. Lone `AGENTS.md` MUST NOT activate Codex (shared with Cursor compile family). Detection MUST NOT mkdir.  
   _Alternative:_ also detect `AGENTS.md` — rejected (false positives with Cursor-only projects).

4. **Skills → `.agents/skills/<name>/`**  
   Match APM Codex `deploy_root=".agents"` / `skill_standard`. Portable Agent Plugins skill directories copy into that destination. Do **not** write `.codex/skills/`.  
   _Alternative:_ dual-write `.codex/skills/` — rejected (APM matrix + cross-tool convergence).

5. **Agents → `.codex/agents/<name>.toml` (MD → TOML)**  
   Parse YAML frontmatter `name` / `description` (+ body → `developer_instructions`). Drop `tools` (and other unsupported FM keys) with a lossy diagnostic (APM `_write_codex_agent`). Use a catalog TOML library for parse/serialize (add via pnpm catalog; do not hand-escape production strings).  
   _Alternative:_ keep agents as markdown — rejected (Codex native TOML agents).  
   _Alternative:_ hand-rolled TOML escape — rejected for correctness/escaping risk.

6. **Instructions / commands / prompts: skip in materialize**  
   Non-fatal diagnostics (e.g. `CODEX_PRIMITIVE_UNSUPPORTED`); install continues. Instructions are compile-only (included in `AGENTS.md`). No native commands/prompts mapping on this host.  
   _Alternative:_ invent `.codex/rules/` — rejected (APM: instructions = compile for Codex).

7. **Hooks: `.codex/hooks.json` + scripts + `.codex/bapm-hooks.json` sidecar**  
   Merge events into native `hooks.json` (preserve unrelated keys / non-owned handlers). Scripts under `.codex/hooks/<name>/`. Ownership mirrors Cursor/Claude sidecar so reinstall strips owned entries; native file stays free of bapm-private keys. Prefer PascalCase event names when normalizing (APM Codex expected casing); document if package JSON already uses host casing.  
   _Alternative:_ lock-only ownership — rejected for host-package idempotence parity.

8. **Forced target / missing `.codex/`: mkdir-on-write for hooks AND MCP (unified)**  
   When Codex runtime is **actively invoked** (forced `--target codex` or materialize/configure after registration for an install that selected Codex), writers MAY `mkdir` `.codex/` (and parents) as needed — align with APM MCP adapter `mkdir` parents, and apply the **same** create policy to hooks so forced installs are not half-broken (agents write, hooks/MCP skip). Auto-detect MUST still require an existing `.codex/` directory and MUST NOT create it solely to opt into detect. Malformed existing `config.toml` / unparseable TOML → skip write + diagnostic (no clobber), matching APM.  
   _Alternative:_ hooks `require_dir` skip while MCP mkdir — rejected (inconsistent forced UX).  
   _Alternative:_ both skip when missing — rejected for forced `--target` empty projects.

9. **MCP: `.codex/config.toml` → `mcp_servers`**  
   Merge owned servers by name; preserve unrelated servers / unrelated top-level TOML tables. Stdio + https streamable-http remote allowed; **reject SSE** (and non-https remote) with per-server diagnostic. Prefer shallow merge of server tables. Reports include config path for lock inventory. No `CODEX_HOME` / user config.  
   _Alternative:_ JSON MCP file — rejected (Codex native TOML).

10. **`compile()` → `AGENTS.md` including instructions**  
    Thin host render (deterministic order), default path `AGENTS.md`, honor `CompileContext.write`. **Include** instruction primitives in the body (compile-only path; opposite of Claude omit-rules). Skills/agents/hooks may appear as thin sections like Cursor’s emitter unless a host chooses to filter — minimum bar: instructions present when supplied.  
    _Alternative:_ omit instructions because Cursor already writes AGENTS.md — rejected (Codex has no rules files; APM rolls instructions into compile).

11. **Shared `AGENTS.md` collision with Cursor (same compile family)**  
    Policy: **last writer wins per compile invocation**. No merge of Cursor + Codex sections in v1. Dual-active projects share one file; recommend a single active compile target. Document collision risk in design/docs; optional non-fatal diagnostic if overwriting a file that already exists is acceptable but not required for v1. Multi-host `--target all` compile ordering remains out of scope (same as M9).  
    _Alternative:_ host-prefixed managed sections — deferred (rich APM polish out of scope).  
    _Alternative:_ Codex writes `.codex/AGENTS.md` — rejected (APM project compile output is root `AGENTS.md`).

12. **Dual export surface**  
    Keep `codexMarketplaceIntegration` for pack; add runtime factory. Pack continues to load marketplace capability separately without calling runtime hooks.

13. **CLI load**  
    Prefer `createIntegration` (already first in `loadIntegrationFromPackage`). No CLI composition changes beyond docs/examples.

## Risks / Trade-offs

- [Root `.` in deployRoots widens write surface] → Mitigation: materialize never writes outside `.codex/` and `.agents/`; compile hard-codes basename allowlist for `AGENTS.md`.
- [Cursor + Codex both compile AGENTS.md] → Mitigation: document last-writer; prefer one active compile target; no invent merge.
- [TOML parse failure on existing config] → Mitigation: skip write + diagnostic; never clobber unreadable files.
- [Forced mkdir vs APM hooks `require_dir`] → Mitigation: unified mkdir-on-write only when Codex is actively invoked; detect stays non-creating.
- [Docs still say Codex is marketplace-only] → Mitigation: update supported-hosts / situations in tasks.
- [New TOML dependency] → Mitigation: add via pnpm catalog only (`pnpm-dependencies` skill); keep `@b-apm/core` free of this dep.

## Migration Plan

1. Land runtime + tests in `@b-apm/integration-codex`; marketplace tests keep passing.
2. Users: ensure `@b-apm/integration-codex` installed, `targets.codex` (or `--target codex`), `bapm install`, optional `bapm compile` when Codex is the active compile target.
3. Rollback: remove map entry / stop using factory; delete generated `.codex/**`, owned hooks, MCP server tables, and project `AGENTS.md` manually if desired. Marketplace pack path remains.

## Open Questions

None blocking; user-scope / rich AGENTS.md polish deferred by design.
