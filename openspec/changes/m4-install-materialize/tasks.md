## 1. Scaffold target packages + pnpm workspace

- [x] 1.1 Create `packages/target-api` as TypeScript ESM + vite-plus package named **`bapm-target-api`** (mirror `packages/core` toolchain: build/test/check scripts, `exports`, `type: module`)
- [x] 1.2 Create `packages/target-cursor` as TypeScript ESM + vite-plus package named **`bapm-target-cursor`** (same toolchain pattern)
- [x] 1.3 Wire workspace membership: `packages/*` glob already covers new dirs; add workspace dependencies via **pnpm CLI + catalog only** (pnpm-dependencies skill) — `bapm-target-cursor` → `bapm-target-api`; `@bapm/core` → `bapm-target-api` only; CLI MAY add `bapm-target-cursor` for e2e — never hand-edit invented versions
- [x] 1.4 Confirm `@bapm/core` `package.json` does **not** list `bapm-target-cursor`

## 2. `bapm-target-api` contracts

- [x] 2.1 Implement types/contracts: target id, detection predicate hook, deploy root(s), materialize context, attributed primitive set shape
- [x] 2.2 Implement register/list registry helpers usable by core Install and tests (no concrete host imports)
- [x] 2.3 Export public package entry; document boundary in short README (core ↔ targets)

## 3. Core FEOD: Primitives module

- [x] 3.1 Create `packages/core/src/modules/Primitives/` directory module with `index.ts`, types, errors, README (public API only via `index.ts`)
- [x] 3.2 Implement discovery floor: local `.apm/` skills/agents/instructions; dependency modules trees; package-root `SKILL.md`; optional `skills/<name>/SKILL.md` if cheap
- [x] 3.3 Implement attribution `local` | `dependency:<name>` (pr-001)
- [x] 3.4 Implement conflict resolution: local overrides dep + diagnostic (pr-002); first-declared dep wins (pr-003)
- [x] 3.5 Export discover/conflict symbols through `app/publicApi.ts` / package entry without breaking M1–M3 exports

## 4. Core FEOD: Install module

- [x] 4.1 Create `packages/core/src/modules/Install/` directory module with `index.ts`, types, errors, README
- [x] 4.2 Implement basic frozen gate (lk-006): absent lock / missing direct pin fail before mutation; reject frozen+update; no lock rewrite on frozen success
- [x] 4.3 Implement `runInstall` / `installProject`: reuse Resolver resolve/download → Primitives discover+conflict → invoke registered targets via `bapm-target-api` → lock write when not frozen; cleanup MAY no-op
- [x] 4.4 Enforce tg-008 mutual exclusion (both `target` and `targets`) and intersection of active ∩ consumer-auth ∩ package-declared; accept vendor ids `x-<vendor>-<name>` (tg-004)
- [x] 4.5 Ensure Install imports Manifest/Lockfile/Resolver/Primitives only via public APIs; target interaction only via `bapm-target-api` (no `bapm-target-cursor` import)
- [x] 4.6 Re-export Install public symbols from package entry

## 5. Manifest target field support (as needed)

- [x] 5.1 Extend Manifest parse/validate to reject both `target` and `targets` present; surface declared target id(s) for Install intersection
- [x] 5.2 Accept vendor-style target ids without requiring a registered implementation at parse time

## 6. Minimal `bapm-target-cursor`

- [x] 6.1 Implement `createCursorTarget` (name flexible) against `bapm-target-api`: detect `.cursor/` (or documented predicate), declare registered deploy roots
- [x] 6.2 Materialize skills under registered roots only; prefer `.agents/skills/<name>/SKILL.md` (tg-003) or document cursor-native registered root
- [x] 6.3 Ensure package depends on `bapm-target-api` only among bapm packages for materialize logic (no hard dep on `@bapm/core`)

## 7. CLI install un-stub (FEOD)

- [x] 7.1 Replace Install stub service with thin wrapper calling `@bapm/core` install; keep `commands/install.ts` thin
- [x] 7.2 Parse `--frozen` (and reject combo with update/re-resolve if exposed); map core success/failure to exit codes
- [x] 7.3 Optionally register `bapm-target-cursor` in CLI `app/init` / integrations for e2e (workspace dep via pnpm CLI)
- [x] 7.4 Update Help text: install is real install (not stub); preserve lock non-deploy messaging
- [x] 7.5 Ensure `lock` path still does not call target materialize

## 8. Verification (apply phase; acceptance authored separately)

- [x] 8.1 Satisfy M4 acceptance checklist C in `.samples/apm-knowledge/topics/m4-install-acceptance.md` once acceptance suite exists (TDD phase) — do not author acceptance in apply unless already present
- [x] 8.2 Keep existing M1–M3 unit/acceptance green; `lock` still leaves harness dirs unchanged
- [x] 8.3 Run build/test/`vp check` for `@bapm/core`, `bapm`, `bapm-target-api`, `bapm-target-cursor` and fix in-scope regressions
