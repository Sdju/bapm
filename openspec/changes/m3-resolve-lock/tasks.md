## 1. Resolver module skeleton (core FEOD)

- [x] 1.1 Create `packages/core/src/modules/Resolver/` directory module with `index.ts`, typed errors, types, and README (public API only via `index.ts`; no single-file module)
- [x] 1.2 Export modules-dir constant `apm_modules`, `MAX_RESOLVE_DEPTH = 50`, and placeholder public symbols (`classifyDependencyRef`, `resolveDependencyGraph`, `downloadPackages`, `resolveAndLock`) from Resolver `index.ts`
- [x] 1.3 Wire Resolver exports through `app/publicApi.ts` and thin `src/index.ts` without breaking existing Manifest/Lockfile named exports
- [x] 1.4 Ensure Resolver imports Manifest/Lockfile only via `@/modules/Manifest` and `@/modules/Lockfile` (no deep imports)

## 2. Dependencies (pnpm catalog)

- [x] 2.1 Add node-semver-compatible package for `@bapm/core` via pnpm CLI + workspace catalog only (no hand-edited versions)
- [x] 2.2 Add any git/download helper deps the chosen default Downloader needs the same way (catalog); prefer minimal surface

## 3. Classify + identity + semver

- [x] 3.1 Implement `classifyDependencyRef` for local / registry / git-semver / git-literal (rs-008/003); registry classify without fetch
- [x] 3.2 Implement minimum-safe repo identity normalize (host case, trailing `.git`; path-case distinct) for cache/resolve keys (rs-016)
- [x] 3.3 Implement node-semver range evaluation + build-metadata ASCII tie-break aligned with OpenAPM dialect (rs-007/014)
- [x] 3.4 Implement git-semver pin helper (tag list port → filter → highest; prerelease exclusion; populate constraint/resolved_tag/resolved_at/resolved_commit) (rs-002, lk-008)

## 4. Graph resolve (OpenAPM diamonds)

- [x] 4.1 Implement BFS resolve with declaration order, depth cap 50 + chain diagnostic, cycle fail-closed (rs-001/006)
- [x] 4.2 Implement intersection-pick for diamonds + empty-∩ fail with both chains `->` diagnostics; set `resolved_by` to tightest chain (rs-001/010)
- [x] 4.3 Refuse `dependencies.conflict_resolution: nest` with clear diagnostic (rs-013)
- [x] 4.4 Implement warm lock replay (rs-015) and character-equal constraint drift re-resolve (rs-004); `updateRefs` / `--update` forces re-resolve
- [x] 4.5 Registry kind: fail closed with deferred/unsupported diagnostic (no silent git fallback; rs-009 out of scope)

## 5. Download + resolveAndLock

- [x] 5.1 Define Downloader / GitRemote / TagLister ports; provide fake-friendly injection for tests
- [x] 5.2 Implement default materialize into `<projectRoot>/apm_modules/` (git fetch/clone by identity; local path copy/link; parallel downloads default 4)
- [x] 5.3 Implement `resolveAndLock`: M1 manifest dual-read (cwd only) → resolve/download → build lock model → M2 `writeLockfile` (write-back / fresh `bapm.lock.yaml` / dual-conflict); skip policy; no target deploy
- [x] 5.4 Ensure git pins always include `resolved_commit`; optionally add cheap `tree_sha256` only if already available; prefer atomic write / no success on failure
- [x] 5.5 Document in Resolver README: `apm_modules` default, OpenAPM ∩-pick vs APM first-wins, policy skipped until M8, registry deferred, hash minimum

## 6. CLI lock command (FEOD)

- [x] 6.1 Add `packages/cli` module wrapping core `resolveAndLock` (soft IoC if needed) and thin `commands/lock.ts` handler
- [x] 6.2 Register `lock` in `app/registry.ts`; parse `--verbose`/`-v`, `--update`, `--parallel-downloads`
- [x] 6.3 Update Help / command constants so usage lists `lock`; keep `install` as non-deploying stub
- [x] 6.4 Map core success/failure to exit codes and user-facing messages (success mentions lockfile written; missing manifest / resolve errors non-zero)

## 7. Verification

- [x] 7.1 Make M3 acceptance (checklist C in `.samples/apm-knowledge/topics/m3-resolve-lock-acceptance.md`, when present from acceptance phase) pass for core resolve/download/lock and optional CLI cases; do not implement target deploy / frozen / registry HTTP
- [x] 7.2 Ensure existing M1/M2 acceptance and unit tests still pass; `install` remains stub
- [x] 7.3 Run `@bapm/core` and `bapm` package build/test/`vp check` (or package-local equivalents) and fix regressions in scope
