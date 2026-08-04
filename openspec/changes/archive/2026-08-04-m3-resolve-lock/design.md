## Context

`@bapm/core` has FEOD modules Manifest (M1) and Lockfile (M2) with dual-read discovery and OpenAPM-preferring R/W. `@bapm/cli` has FEOD commands help/version/install-stub. There is no resolver, no modules cache materialization, and no `lock` command. Motivation: see `proposal.md`. Normative checklist: `.samples/apm-knowledge/topics/m3-resolve-lock-acceptance.md`. Behavior: delta specs `dependency-resolve`, `lock-command`, plus FEOD/CLI surface deltas.

## Goals / Non-Goals

**Goals:**

- Implement Resolver as a library FEOD module in `@bapm/core` with injectable ports for git/tag/download so acceptance can use fakes
- Prefer OpenAPM diamond policy (intersection-pick) and document APM first-wins as a known gap
- Materialize into `apm_modules`; write locks only via Lockfile public API
- Thin CLI `lock` wrapping `resolveAndLock`; skip policy until M8

**Non-Goals (design-level):**

- Target adapters / harness deploy / frozen CI / registry HTTP client
- Parent-directory manifest walk; APM first-wins
- Full `tree_sha256` depth beyond cheap optional enrichment
- Authoring acceptance tests in this change (separate TDD phase)
- Hand-editing dependency versions (apply uses pnpm CLI + catalog)

## Decisions

### 1. Modules dir = `apm_modules`

- **Choice:** Constant `APM_MODULES_DIR = "apm_modules"` (name flexible) as the only M3 modules root; document wire parity with APM. `bapm_modules` alias deferred.
- **Why:** Drop-in for existing APM projects and tooling that expect `apm_modules/`.
- **Alternatives:** Brand-first `bapm_modules` only — rejected for M3 wire parity; dual accept — deferred.

### 2. FEOD layout: core Resolver + CLI Lock module

- **Choice:**
  - Core: `packages/core/src/modules/Resolver/` with public API (`classifyDependencyRef`, `resolveDependencyGraph`, `downloadPackages`, `resolveAndLock`, `MAX_RESOLVE_DEPTH = 50`, modules dir constant). Soft-optional ports: `GitRemote` / `TagLister` / `Downloader`.
  - CLI: `commands/lock.ts` thin handler; `modules/Lock/` (or `LockCommand`) wrapping core; register in `app/registry.ts`; update Help constants.
- **Why:** Matches locked FEOD profiles (library-core + CLI skill); keeps domain in core.
- **Alternatives:** Resolve logic in CLI — rejected; monolithic core file — rejected (single-file modules forbidden).

### 3. Orchestration surface = `resolveAndLock`

- **Choice:** One primary API that: loads manifest (M1 dual-read, cwd only) → optional warm lock load (M2 nullable) → BFS resolve with ports → download missing into `apm_modules` → build lock model → `writeLockfile` (M2 write-back / fresh `bapm.lock.yaml`). Options: `{ cwd?, updateRefs?, parallelDownloads?, downloader?, … }`.
- **Why:** Mirrors APM `lockfile_only` pipeline minus targets/policy; single entry for CLI and acceptance.
- **Alternatives:** Separate CLI-only pipeline — rejected (harder TDD, duplicates rules).

### 4. Diamond policy = OpenAPM intersection-pick

- **Choice:** Implement intersection of semver constraints + highest in ∩; empty ∩ fail-closed with dual-chain `->` diagnostics; refuse `nest`. Do not implement APM `_select_dependency_winners` first-wins.
- **Why:** OpenAPM req-rs-001 / 010 / 013; product prefers OpenAPM for wire claim.
- **Alternatives:** Match APM first-wins for byte-identical graphs — rejected (documented gap).

### 5. Downloader port + one real git path

- **Choice:** Define a `Downloader` (and tag/list remote) port; unit/acceptance use fakes; ship one default git-backed implementation for integration (clone/fetch into cache keyed by rs-016 identity). Local deps: copy or link from path without network (APM-like).
- **Why:** Acceptance checklist needs deterministic fixtures; real git still needed for e2e smoke.
- **Alternatives:** Real git only — brittle tests; fake only — weak drop-in confidence.

### 6. Hash / pin minimum for M3

- **Choice:** MUST write `resolved_commit` (40-hex) for git; MUST write git-semver lk-008 fields when kind is git-semver. `tree_sha256` / content hash: compute only if cheap after tree is on disk; otherwise omit and leave enrichment to M4. Still normalize hash envelopes via M2 when hashes are present.
- **Why:** Acceptance open question; pins are real via download without blocking on full tree hashing.
- **Alternatives:** Full tree hash in M3 — deferred as depth/perf risk.

### 7. Policy = skip until M8

- **Choice:** No policy gate, no `--no-policy` / `--target` flags in M3 CLI. Document that APM runs policy on `apm lock` and bapm intentionally skips.
- **Why:** User default for open gap; avoids half-policy surface.
- **Alternatives:** Warn-only stub — unnecessary noise for M3.

### 8. Warm replay vs materialize

- **Choice:** Without `--update`, reuse lock `resolved_commit` when manifest ref/constraint character-equal (rs-015 / rs-004). Still download into modules if cache missing (object fetch ≠ ref resolution).
- **Why:** Matches OpenAPM warm replay while keeping modules materialization for pin integrity / later install.
- **Alternatives:** Skip download when lock warm — rejected (M3 includes materialize-to-modules).

### 9. Registry = classify + fail closed

- **Choice:** Classify `registry` kind; any resolve/fetch attempt fails with clear “registry deferred” error (rs-009 out of scope).
- **Why:** Prevents silent git fallback; keeps M10/registry milestone honest.
- **Alternatives:** Ignore registry deps — rejected (silent wrong graph).

### 10. Semver dialect

- **Choice:** Use a node-semver-compatible library added via **pnpm CLI + workspace catalog** during apply (not hand-edited manifests). Port OpenAPM `semver-dialect.json` into acceptance fixtures in the acceptance phase.
- **Why:** req-rs-007/014; catalog skill forbids invented versions in propose.
- **Alternatives:** Hand-rolled semver — rejected (oracle drift risk).

### 11. CLI flag subset

- **Choice:** Expose `--verbose`/`-v`, `--update`, `--parallel-downloads` (default 4). Defer `--global`, `--no-policy`, `--target`, `lock export`.
- **Why:** Enough for APM lock drop-in ergonomics without policy/SBOM scope.
- **Alternatives:** Full APM Click flag parity — rejected for M3 non-goals.

### 12. Error / atomicity

- **Choice:** Prefer fail without success messaging; write lock only after successful resolve+download of required pins (temp file + rename acceptable). Typed errors for classify/resolve/download/lock dual-conflict/missing manifest.
- **Why:** Acceptance item 23; avoids half-written “success” locks.
- **Alternatives:** Best-effort partial lock — rejected.

### 13. Targets boundary

- **Choice:** Resolver and `lock` MUST NOT import or register `bapm-target-*`; no target detection.
- **Why:** `target-package-architecture` unchanged; M4–M5 own deploy.

## Risks / Trade-offs

- **[Risk] OpenAPM ∩-pick ≠ APM first-wins** → Different winner graphs vs APM on diamonds → **Mitigation:** Document gap; golden fixtures assert OpenAPM behavior.
- **[Risk] Real git flaky in CI** → **Mitigation:** Port + fakes for MUST cases; optional integration gated or local-only.
- **[Risk] Incomplete tree hashes vs later frozen/install** → **Mitigation:** M3 minimum `resolved_commit`; M4 deepens hashes/frozen.
- **[Risk] Scope creep into install/policy** → **Mitigation:** Explicit non-goals; install stays stub.
- **[Risk] `apm_modules` brand tension** → **Mitigation:** Document constant; alias later if product wants dual.

## Migration Plan

- Additive: new Resolver exports; new CLI `lock`; help text gains `lock`.
- No rename of existing M1/M2 APIs; no on-disk migration of user locks beyond normal write-back.
- Rollback: remove Resolver exports / `lock` command registration; leave M1/M2 intact.

## Open Questions

- Exact CLI module name (`Lock` vs `LockCommand`) — finalize to FEOD taste during apply; behavior fixed by specs.
- Whether default Downloader uses `git` CLI subprocess vs isomorphic-git — choose during apply by packaging cost; port interface stays.
