## 1. Tooling and layer scaffold

- [x] 1.1 Add `feod` block to `packages/core/package.json` per design D1 (`layerDirs.pages` → `pages`, not `commands`)
- [x] 1.2 Add `@/*` → `./src/*` path mapping in `packages/core/tsconfig.json`
- [x] 1.3 Create FEOD directories under `packages/core/src`: `app/`, `modules/`, `common/`, `globals/`, `pages/` with `pages/.gitkeep` only
- [x] 1.4 If `vp pack` / tests / type-aware lint fail to resolve `@/`, add matching `resolve.alias` in `packages/core/vite.config.ts`

## 2. Common YAML and module move

- [x] 2.1 Move safe-subset YAML loader to `common/yaml/` with neutral error type (no `ManifestError` in common); no `common/index.ts`
- [x] 2.2 Create `modules/Manifest/` (directory + `index.ts`): move discover/load/parse/types/errors; wrap common YAML → public `loadYamlDocument` still throws `ManifestError` with existing codes
- [x] 2.3 Create `modules/Lockfile/` (directory + `index.ts`): move discover/load/parse/serialize/hash/identity/equivalence/types/errors; map common YAML errors → `LockfileError` without importing Manifest internals or Manifest module for YAML
- [x] 2.4 Add brief `README.md` to each module (purpose + public API)
- [x] 2.5 Delete obsolete flat `src/manifest/` and `src/lockfile/` trees after move

## 3. Public API façade

- [x] 3.1 Implement `app/publicApi.ts` re-exporting Manifest + Lockfile public APIs plus `BAPM_NAME` / `getVersion`
- [x] 3.2 Make `src/index.ts` a thin façade over `app/publicApi` preserving **all** previous named exports 1:1 (types and values)
- [x] 3.3 Grep/verify: no deep imports into `modules/*/…` from outside; no Lockfile→Manifest internal paths; no `common` barrel

## 4. FEOD library profile note

- [x] 4.1 Add `.cursor/skills/feod/library-core.md` documenting the library profile (D1 table + layout); do **not** change the locked CLI profile table/rules in `SKILL.md`
- [x] 4.2 Optionally add a single “Дополнительно” pointer in `SKILL.md` / `reference.md` to `library-core.md` without altering CLI locked wording

## 5. Verify

- [x] 5.1 Confirm unit/acceptance tests still import from `src/index.ts` (or package entry); update only if path breakage requires it — do not change behavioral expectations
- [x] 5.2 Run `vp check` in `packages/core` and fix type/lint issues from the move
- [x] 5.3 Run `vp test` in `packages/core` — unit + M1 + M2 acceptance MUST stay green
- [x] 5.4 Run `vp pack` (or `vp run build`) in `packages/core` and confirm `dist/index` builds with export parity
- [x] 5.5 FEOD checklist: layers present including empty `pages`; modules are directories with `index.ts`; common has no barrel; Lockfile does not deep-import Manifest; package entry remains thin; no CLI code changes unless export breakage forces a follow-up
