## Context

See proposal.md — Why. Cursor/Codex/Copilot already materialize skills to `.agents/skills/<n>/SKILL.md` via `materializeSkill` from `@bapm/integration-api`. APM `KNOWN_TARGETS["agent-skills"]` is skills-only, `detect_by_dir=False`, `root_dir=".agents"`, explicit `--target` / manifest only. bapm already allows the `agent-skills` token in `CANONICAL_TARGET_TOKENS` and activates hosts via object-map + `active` / forced target without needing detect.

## Goals / Non-Goals

**Goals:**

- Greenfield `@bapm/integration-agent-skills` as the thinnest possible `BapmIntegration` (detect + materialize).
- Parity with APM targets-matrix §agent-skills for project-scope skills deploy.
- Reuse `materializeSkill` / `primitivesMaterialize` patterns from Cursor/Codex.

**Non-Goals:**

- User-scope `~/.agents/skills/` (`-g`) in this change.
- `configureMcp`, hooks, compile.
- Changing core detect/`all` fan-out semantics beyond what already exists for explicit hosts.
- Implementing antigravity in this package.

## Decisions

### 1. Package id and factory

- **Choice:** Package `@bapm/integration-agent-skills`; runtime `id: "agent-skills"`; export `createAgentSkillsIntegration` + `createIntegration` alias (same pattern as Copilot/Codex).
- **Alt:** Fold into Cursor/Codex — rejected; APM treats agent-skills as its own target for author-time cross-client bundles.

### 2. Never-detect

- **Choice:** `detect` always returns `false`. Activation relies on existing core paths: forced `--target` and/or `active: [agent-skills]` after object-map load.
- **Alt:** Detect when `.agents/skills/` exists — rejected; APM explicitly avoids this because `.agents/` is shared.

### 3. Skills-only materialize

- **Choice:** Only the `skill` handler writes files via `materializeSkill({ destDir: join(".agents", "skills", name) })`. All other kinds push non-fatal diagnostics (`AGENT_SKILLS_PRIMITIVE_UNSUPPORTED` or similar) and write nothing.
- **Alt:** Throw on non-skills — rejected; install should stay non-fatal like Codex unsupported kinds.

### 4. No MCP / hooks / compile

- **Choice:** Omit `configureMcp` and `compile` from the integration object entirely. Core already treats missing capabilities as skip.
- **Alt:** Stub no-op methods — rejected; absence is clearer and matches “thin host”.

### 5. Deploy roots

- **Choice:** `deployRoots: [".agents"]` only. No `"."` root (no compile emission).
- **Alt:** Include `"."` “just in case” — rejected; expands write surface without benefit.

### 6. Overlap with antigravity / Cursor / Codex / Copilot

- **Choice:** Document shared `.agents/skills/` as intentional. No exclusive lock or conflict refuse in this package.
- **Alt:** Namespaced path under `.agents/bapm-skills/` — rejected; breaks APM / agentskills.io parity.

### 7. Workspace scaffold

- **Choice:** Mirror `packages/integration-codex` structure minus MCP/hooks/toml deps: `package.json` (workspace `@bapm/integration-api` only), `tsdown`/`vp` scripts, `src/createAgentSkillsIntegration.ts`, `src/index.ts`, unit tests, README, docs update in `apps/docs/guide/supported-hosts.md`.

## Risks / Trade-offs

- [Risk] Authors expect auto-detect from `.agents/` → Mitigation: docs + detect tests asserting false; activation examples with `active` / `--target`.
- [Risk] Dual materialize with Cursor/Codex to same path → Mitigation: accepted shared-path semantics; acceptance notes overlap OK.
- [Risk] Missing user-scope parity with APM `-g` → Mitigation: explicit non-goal; follow-up change if needed.

## Migration Plan

1. Add package to workspace; `vp install` / catalog unchanged (only workspace dep).
2. Docs: add agent-skills row/section.
3. No lockfile format migration; no core API break.
4. Rollback: remove package + docs; object-map entries simply fail to resolve if left behind.

## Open Questions

None — APM matrix and existing activation contracts are sufficient.
