## 1. Dependencies and module skeleton

- [x] 1.1 Add a YAML parsing dependency to `@b-apm/core` via pnpm catalog / workspace CLI only (do not hand-edit version pins); follow `.cursor/skills/pnpm-dependencies/SKILL.md`
- [x] 1.2 Extend `packages/core/src/manifest/` with modules for discovery, YAML load (safe-subset guards), validate/parse, typed errors, and types that retain unknown/`x-*` keys plus `sourcePath` / `sourceFilename`
- [x] 1.3 Export `APM_MANIFEST_FILE`, keep `BAPM_MANIFEST_FILE`, and re-export `discoverManifestPath`, `loadManifest`, and strengthened `parseManifest` / document-parse from `packages/core/src/index.ts`

## 2. Dual-file discovery

- [x] 2.1 Implement `discoverManifestPath({ cwd?, path? })`: explicit path wins; root defaults to cwd; no parent walk-up
- [x] 2.2 Enforce existence matrix — only `apm.yml` → that path; only `bapm.yml` → that path; both → hard error naming both paths; neither → no-manifest error
- [x] 2.3 Ensure discovery records `filename` (`apm.yml` | `bapm.yml`) for same-filename write-back metadata (no rewrite API)

## 3. YAML load and OpenAPM-strict validate

- [x] 3.1 Implement YAML load that rejects anchors/aliases and custom tags (req-mf-020); map syntax errors to typed diagnostics
- [x] 3.2 Validate top-level mapping; require non-empty string `name` and `version`; reject numeric/empty versions; optional non-blocking semver warning (mf-001..004)
- [x] 3.3 Validate `dependencies` / `devDependencies` as mappings when present; parse `apm` string and object entries without resolve (mf-007..010)
- [x] 3.4 Reject object deps with no source, unknown source kind, or both `id`+`git` (mf-011, mf-012); accept exactly one of `git`|`id`|`path`|`registry`, with `path` as optional companion to `git` (required for `git: parent`); allowlist meta `alias`/`skills`/`targets`
- [x] 3.5 Validate `registries` when present: https scheme, skip/validate `registries.default` as name pointer, reject typo/unknown entry keys and token-in-YAML if APM does (mf-014, mf-015)
- [x] 3.6 Accept unknown top-level and `x-*` / `default_host` on the in-memory model; reject `workspaces` (mf-019..021, ext-001/002 read-side); reject simultaneous `target`+`targets`
- [x] 3.7 Implement `loadManifest` = discover → read file → safe YAML → validate; do not resolve, lock, download, or install

## 4. Wire acceptance and verification

- [x] 4.1 Make acceptance suite under `packages/core/tests/acceptance/m1-manifest-yaml-dual-read/` pass (checklist C: discovery matrix, validation cases, ported fixtures valid-minimal / invalid-missing-name / x-extension, dual conflict, real `.samples/apm/apm.yml` when available with CI-safe copied fixtures)
- [x] 4.2 Update or replace `packages/core/tests/index.test.ts` so unit/smoke coverage matches the new public API without asserting rewrite/lock/install
- [x] 4.3 Run `vp run -r build` / `@b-apm/core` test + `vp check` (or package-local equivalents) and fix regressions in core only

## 5. Docs touch-up (minimal)

- [x] 5.1 Document in `packages/core/README.md` dual-read rules, OpenAPM-strict anchors, and that rewrite/mf-006 is deferred; note write-back MUST use loaded filename later
