## 1. Module skeleton and exports

- [x] 1.1 Add or extend `packages/core/src/lockfile/` with types, typed errors, discovery, parse/validate, serialize/write, and semantic-equivalence helpers (reuse M1 YAML safe-subset loader; no new YAML stack unless required)
- [x] 1.2 Export `APM_LOCK_FILE`, keep/align `BAPM_LOCK_FILE`, and public APIs `discoverLockfilePath`, `loadLockfile`, `loadLockfileOrNull`, `parseLockfile` / document-parse, `serializeLockfile`, `writeLockfile`, `isSemanticallyEquivalent` from `packages/core/src/index.ts`

## 2. Dual-file discovery and write targets

- [x] 2.1 Implement `discoverLockfilePath({ cwd?, path? })`: explicit path wins; root defaults to cwd; no parent walk-up; ignore legacy `apm.lock`
- [x] 2.2 Enforce existence matrix — only `apm.lock.yaml` → that path; only `bapm.lock.yaml` → that path; both → hard dual-conflict naming both paths; neither → not-found for discover/strict load
- [x] 2.3 Implement `loadLockfileOrNull` returning null only when neither file exists (corrupt files still error)
- [x] 2.4 Implement `writeLockfile`: write-back same loaded filename/path; fresh create without path → `bapm.lock.yaml`; never auto-create sibling brand

## 3. Parse, validate, serialize (OpenAPM M2 MUST)

- [x] 3.1 Parse/validate container: mapping root; `dependencies` list required; `lockfile_version` ∈ {`"1"`,`"2"`}; absent version → default `"1"` on read; unsupported version → upgrade/regenerate diagnostic (lk-001, lk-004)
- [x] 3.2 Validate git / registry entry shapes (lk-003); reject registry without `resolved_hash`; do not fetch or verify archives
- [x] 3.3 Emit policy: always write explicit `lockfile_version`; force `"2"` for any `source: registry`; never demote loaded `"2"` → `"1"`; MAY bump for git-semver fields (lk-002 monotonic)
- [x] 3.4 Serialize: omit unset/null placeholders; sort deps by `(repo_url, virtual_path)`; preserve unknown + `x-*` (incl. deployments/lsp_* bags); hash bare-hex → envelope on read, envelopes on write (lk-005, lk-011, lk-014, lk-016)
- [x] 3.5 Validate `materialization_repo_url` identity vs `repo_url` when present (lk-022); preserve inventory `name`/`version` without using them as identity (lk-019)
- [x] 3.6 Handle self-entry: flat `local_deployed_*` round-trip; never emit self into `dependencies`
- [x] 3.7 Accept deferred shapes (constraint/resolved_tag/resolved_at, deployed hashes, resolved_hash, tree_sha256) without resolve/download/hash recompute (lk-008/012/013/015 shape only)
- [x] 3.8 Implement `isSemanticallyEquivalent` ignoring `generated_at` / `apm_version` (lk-005)

## 4. Wire acceptance and verification

- [x] 4.1 Make acceptance suite for M2 pass (checklist C in `.samples/apm-knowledge/topics/m2-lockfile-acceptance.md`: parse/serialize/discovery cases; ported OpenAPM lock fixtures; dual conflict; write-back / fresh create; real APM lock bytes when sample present with CI-safe copied fixtures). Do not expand into resolve/install/targets.
- [x] 4.2 Update core unit/smoke tests for the new lockfile public API without asserting resolve/download/install/frozen/targets
- [x] 4.3 Run `@bapm/core` build/test/`vp check` (or package-local equivalents) and fix regressions in core only

## 5. Docs touch-up (minimal)

- [x] 5.1 Document in `packages/core/README.md` lock dual-read rules, monotonic v2 vs APM demote, OpenAPM sort, write-back/fresh-create defaults, and that resolve/install/targets/frozen are out of M2
