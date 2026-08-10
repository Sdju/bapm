## Context

M3 delivered Resolver + `resolveAndLock` + `bapm lock` with modules under `apm_modules`. `bapm install` remains a failing stub. Main specs already lock `target-package-architecture` (no in-tree APM adapters; scaffold deferred until an explicit change). See `proposal.md` for motivation; normative checklist: `.samples/apm-knowledge/topics/m4-install-acceptance.md`. Behavior contracts: delta specs under this change.

## Goals / Non-Goals

**Goals:**

- FEOD library modules Install + Primitives in `@b-apm/core`; speak deploy only via `bapm-target-api`
- Scaffold `packages/target-api` (`bapm-target-api`) and `packages/target-cursor` (`bapm-target-cursor`) with vite-plus; wire pnpm workspace at apply via CLI
- Thin CLI `install` happy path + basic `--frozen`; keep `lock` non-deploying
- OpenAPM M4 MUST: pr-001..003, tg-008/004/002, tg-003 if cursor ships skills, lk-006 basic

**Non-Goals (design-level):**

- Multi-adapter catalog / in-tree APM `adapters/client/`
- M5 polish (orphan cleanup, gitignore, richer cursor, extra hosts)
- Policy, compile, registry, MCP full integrate
- Authoring acceptance tests in this change (separate TDD phase)
- Hand-editing dependency versions (apply uses pnpm CLI + catalog)

## Decisions

### 1. Package names and paths (locked)

- **Choice:** `packages/target-api` → name **`bapm-target-api`**; `packages/target-cursor` → name **`bapm-target-cursor`** (unscoped npm names, matching architecture docs). Not `@b-apm/target-api`.
- **Why:** User/scope lock + `bapm-target-packages.md` / OpenSpec architecture naming.
- **Alternatives:** `@b-apm/target-*` scope — rejected for this change.

### 2. FEOD layout: core Install + Primitives; CLI thin install

- **Choice:**
  - Core library FEOD: `modules/Install/`, `modules/Primitives/` (directories + `index.ts`); soft IoC for target registry injection optional at app/publicApi or Install factory.
  - CLI: keep `commands/install.ts` thin; replace stub service with call to `@b-apm/core` install; register cursor in CLI `app/init` or integrations (not in core).
- **Why:** Locked library-core + CLI FEOD profiles; domain stays in core; CLI wires host package for e2e.
- **Alternatives:** Host materialize inside core — rejected (`target-package-architecture`).

### 3. Core depends only on `bapm-target-api`

- **Choice:** Add workspace dependency `@b-apm/core` → `bapm-target-api`. Never add `bapm-target-cursor` to core `package.json`. CLI MAY depend on both `bapm-target-api` (transitive via core) and `bapm-target-cursor` for registration.
- **Why:** Registration/injection boundary; acceptance item “no hard import of concrete target”.
- **Alternatives:** Core optional peer on cursor — rejected (still a hard coupling risk).

### 4. Install orchestration surface

- **Choice:** Primary API e.g. `runInstall` / `installProject` options: `{ cwd?, frozen?, updateRefs?, targetRegistry?, downloader?, … }`. Pipeline order aligned with APM map: enforce frozen → resolve/download (reuse Resolver) → discover primitives → conflict resolve → invoke active registered targets → lock write (skip if frozen) → result. Orphan cleanup MAY no-op in M4.
- **Why:** Mirrors APM install phases without policy/cleanup polish; single entry for CLI and acceptance.
- **Alternatives:** Separate integrate-only API without resolve — insufficient for fresh install checklist.

### 5. Target registry in `bapm-target-api`

- **Choice:** API package exports types + a small registry/register helper (or factory) that core Install accepts as an injected registry/list of targets. Cursor package exports a `createCursorTarget()` (name flexible) implementing the contract; CLI/tests call `register`.
- **Why:** Core never imports cursor; tests can register mocks.
- **Alternatives:** Dynamic `import()` of cursor from core by convention — rejected (hidden hard dep).

### 6. Cursor minimal surface

- **Choice:** Detect `.cursor/` (or document equivalent); register deploy roots that include skills path preferring `.agents/skills/<name>/SKILL.md` (tg-003). Materialize skills only in M4; agents/instructions deploy MAY stub or skip with clear unsupported if not cheap. No copilot/claude packages.
- **Why:** Enough for e2e checklist item 20; polish → M5.
- **Alternatives:** API-only + mock-only — rejected by locked scope (MUST scaffold cursor).

### 7. Primitives discovery floor

- **Choice:** Implement local + dependency `.apm/` patterns for skills/agents/instructions; root `SKILL.md` bundles; conflict pr-002/003; clear attribution pr-001. Skill collection `skills/<name>/SKILL.md` if cheap. Skip plugin/MCP integrate.
- **Why:** Matches M4 acceptance floor without full §8.1 matrix.
- **Alternatives:** Skills-only discovery — weaker OpenAPM claim for agents/instructions types.

### 8. Manifest `target` / `targets`

- **Choice:** Extend Manifest validate/parse to reject both fields (tg-008); expose declared target ids for Install intersection. Accept `x-<vendor>-<name>` as ids (tg-004).
- **Why:** Wire basics are M4 MUST; full OpenAPM registry predicate catalog deferred.
- **Alternatives:** Defer tg-008 to M5 — rejected (locked MUST).

### 9. Basic frozen (lk-006)

- **Choice:** Gate before mutation: require lock present; require direct pins; reject `--frozen` + `--update` (or equivalent); never rewrite lock in frozen mode. Do not implement lk-017 hash re-verify unless M4 already writes those hashes (default: package pins only; deployed hashes → M5 unless trivial).
- **Why:** Roadmap “basic frozen”; avoids lk-017 scope creep.
- **Alternatives:** Full deployed_file_hashes in M4 — optional only if cheap; not required.

### 10. Workspace wiring at apply

- **Choice:** Document and task: create packages under `packages/*` (already covered by `pnpm-workspace.yaml` glob `packages/*`). Add deps with **pnpm CLI + catalog** per pnpm-dependencies skill (`pnpm add` / workspace protocol). Do not hand-edit version pins in propose.
- **Why:** Glob already includes new dirs; still need package.json + workspace:* edges via CLI.
- **Alternatives:** Hand-edit manifests — forbidden by skill.

### 11. Modules dir branding

- **Choice:** Keep M3 `apm_modules` constant; no rename in M4.
- **Why:** Open question from M3/M4 docs remains deferred; wire parity preserved.
- **Alternatives:** Introduce `bapm_modules` alias — out of M4 scope.

### 12. Error / atomicity

- **Choice:** Fail closed before writes on frozen violations and target/targets dual fields. Prefer no success messaging on failure. Lock write only when not frozen and after successful resolve/download (+ integrate attempt policy: if materialize fails, fail without claiming success; whether to leave partial harness files — prefer fail-closed / document best-effort cleanup as M5).
- **Why:** Matches acceptance fail-before-mutation posture.
- **Alternatives:** Best-effort partial deploy — deferred to M5 polish.

## Risks / Trade-offs

- **[Risk] Cursor deploy root vs OpenAPM companion mismatch** → **Mitigation:** Document roots in cursor package README; prefer tg-003 path when claiming skills.
- **[Risk] CLI registration of cursor couples e2e to one host** → **Mitigation:** Registration is additive; core remains host-agnostic; more hosts in M5.
- **[Risk] Scope creep into cleanup/audit/policy** → **Mitigation:** Explicit non-goals; cleanup MAY no-op.
- **[Risk] Manifest schema gaps for target fields** → **Mitigation:** Minimal parse/validate extension in Manifest; full schema polish later.
- **[Risk] Workspace package bootstrap cost** → **Mitigation:** Mirror `packages/core` vite-plus templates; tasks call out scaffold checklist.

## Migration Plan

- Additive packages + core modules + CLI install un-stub; help text update.
- Existing M1–M3 APIs remain; `lock` behavior unchanged except clarified non-deploy under registered targets.
- Rollback: remove target packages and Install/Primitives exports; restore install stub; leave M3 intact.

## Open Questions

- Exact public symbol names (`runInstall` vs `installProject`, registry helper names) — finalize to FEOD taste during apply; behavior fixed by specs.
- Whether M4 writes `deployed_files` / hashes into lock — default no unless trivial; does not block lk-006 basic.
- Cursor detection predicate details beyond `.cursor/` — document in package README at apply.
