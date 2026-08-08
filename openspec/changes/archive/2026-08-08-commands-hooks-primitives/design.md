## Context

See proposal.md for motivation. Today `Primitives/discover.ts` only walks `.apm/{skills,agents,instructions}`; Cursor and OpenCode materialize explicitly skip commands/hooks; Agent Plugins matrix marks hooks/commands `not-supported`. APM reference: commands share `.apm/prompts/*.prompt.md` (no `.apm/commands/`); hooks from `.apm/hooks/*.json` and/or top-level `hooks/*.json`; Cursor deploy `.cursor/commands/<name>.md` + merge `.cursor/hooks.json`; OpenCode commands yes / hooks skip.

Conflict resolution and lock inventory already accept arbitrary `PrimitiveType` strings via `AttributedPrimitive` — the gap is discovery + host writers + Agent Plugins path mapping.

## Goals / Non-Goals

**Goals:**

- End-to-end APM-wire parity for command/hook discovery and Cursor materialize.
- OpenCode commands deploy; hooks explicit skip (matrix honesty).
- Agent Plugins: declared `commands`/`hooks` in `plugin.json` supported with fail-closed path checks; matrix updated.
- Keep FEOD boundaries: discovery in core Primitives; host transforms in integration packages; no core→cursor hard dep.

**Non-Goals:**

- New host packages (Claude/Copilot/Gemini/…).
- Separate Copilot `prompts` deploy surface (type `prompt` as distinct harness output).
- Full executable deny gates for hooks (remain CONFORMANCE soft / MCP-only).
- Inventing OpenCode native hooks support.
- Auto-claiming undeclared Agent Plugins agents / client extensions.

## Decisions

### D1 — Primitive types: `command` and `hook` (not inventing `.apm/commands/`)

- **Choice:** Discover prompt markdown as type `command`; JSON hook files as type `hook`. Do not require `.apm/commands/` for APM packages.
- **Rationale:** Matches microsoft/apm CommandIntegrator / package-types docs.
- **Alternatives:** Dual-type each prompt as both `prompt` and `command` — deferred until a Copilot/prompts host exists; would double conflict keys without consumer benefit today.

### D2 — Discovery locations

- **Choice:** Extend `scanTypedApm` / package scan for:
  - `.apm/prompts/*.prompt.md` (+ root `*.prompt.md`)
  - `.apm/hooks/*.json` (+ top-level `hooks/*.json`)
- **Rationale:** APM layouts including hook-only packages.
- **Alternatives:** Only `.apm/` typed dirs — rejected (breaks top-level hooks / root prompts compat).

### D3 — Cursor command transform

- **Choice:** Write Claude-format subset markdown to `.cursor/commands/<name>.md`; preserve `description`, `allowed-tools`, `model`, `argument-hint`, `input`; drop other frontmatter keys with diagnostics (APM Cursor note).
- **Rationale:** Cursor reuses Claude command transformer in APM.
- **Alternatives:** Verbatim copy of `.prompt.md` — rejected (wrong extension/frontmatter for Cursor slash-commands).

### D4 — Cursor hooks merge + ownership

- **Choice:** Merge into `.cursor/hooks.json` (flat `command` shape). Copy referenced scripts under `.cursor/hooks/` (or equivalent registered subpath) and rewrite command paths. Track ownership via sidecar (prefer `.cursor/bapm-hooks.json`, APM-analogue of `apm-hooks.json`) **and** report all written paths in `MaterializeReport` for lock inventory/orphan cleanup.
- **Rationale:** Merge without clobbering user hooks; uninstall needs deterministic owned keys.
- **Alternatives:** Replace entire `hooks.json` — rejected (destructive). Lock-only ownership without sidecar — weaker for partial edits / multi-pass merge.

### D5 — OpenCode hooks

- **Choice:** Skip hooks with inspectable diagnostic; still deploy commands to `.opencode/commands/<name>.md`.
- **Rationale:** APM targets matrix; user asked to respect current host boundaries.
- **Alternatives:** Fail install when hooks present — rejected (APM silently skips; we improve honesty with diagnostics without failing the whole install).

### D6 — Agent Plugins declared paths

- **Choice:** Parse `commands` / `hooks` arrays (or APM-equivalent field shapes) from `plugin.json`; resolve under plugin root; fail closed on missing/escape; feed into the same primitive list. Update `compatibility-cases.json` + generated matrix: add supported/target-specific cases; shrink blanket `unsupported-components` to remaining non-goals (agents undeclared, OAuth, sandbox, client extensions, …).
- **Rationale:** User asked for Agent Plugins “where appropriate”; APM treats declared paths as requirements.
- **Alternatives:** Keep matrix not-supported while discovering APM `.apm/` only — rejected (incomplete vs user goal).

### D7 — Security / trust surface

- **Choice:** Materialize hooks without expanding org/user executable deny gates beyond current MCP-only honesty. Document that installing hooks remains a trust decision; do not claim `req-sc-*` coverage for hook binaries.
- **Rationale:** CONFORMANCE already soft on hooks/bin/canvas gates; expanding gates is a separate change.
- **Alternatives:** Block all hooks until gates exist — rejected (blocks parity; APM ships hooks with separate security module).

### D8 — Diagnostics channel

- **Choice:** Reuse existing materialize/install diagnostic patterns (structured diagnostics on the conflict-resolved set or materialize report extension if already present). Prefer non-fatal diagnostics for OpenCode hook skip and frontmatter drops; fatal for Agent Plugins path escape/missing.
- **Rationale:** Matches fail-closed vs skip semantics in specs.

## Risks / Trade-offs

- **[Risk] Hook JSON dialect variance (Claude nested matcher vs Cursor flat)** → Mitigate: implement Cursor flat `command` writer first; reject or adapt unknown shapes with clear diagnostics rather than inventing Copilot/Claude writers in this change.
- **[Risk] Sidecar + lock inventory drift** → Mitigate: single writer owns both; tests for re-install idempotence and uninstall orphan.
- **[Risk] Agent Plugins field shape ambiguity across vendors** → Mitigate: support the shapes APM `_map_plugin_artifacts` accepts; fail closed on unknown required path entries; document in matrix.
- **[Risk] Frontmatter drop surprises authors** → Mitigate: diagnostics listing dropped keys; docs note preserved key set.
- **[Trade-off] Explicit OpenCode hook skip vs APM silent skip** → Prefer explicit diagnostic (stricter honesty, still non-fatal).

## Migration Plan

1. Ship discovery + host materialize behind normal install (no new CLI flag).
2. Update Agent Plugins matrix generation inputs; run `agent-plugins:check`.
3. Existing projects without commands/hooks: no behavior change.
4. Projects that previously silently ignored `.apm/prompts` / hooks: will start deploying — call out in changelog/docs.
5. Rollback: revert change; harness files already written remain until uninstall/orphan (same as other primitives).

## Open Questions

- Exact `plugin.json` array vs object forms for `commands`/`hooks` beyond APM’s documented path lists — resolve during apply by reading APM `_map_plugin_artifacts` / fixtures; specs already require fail-closed on missing/escaping paths.
