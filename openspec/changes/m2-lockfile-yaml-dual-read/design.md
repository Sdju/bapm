## Context

`@bapm/core` already has M1 manifest dual-discovery + YAML safe-subset validate, and exports `BAPM_LOCK_FILE`. There is no lockfile parse/serialize model, no `apm.lock.yaml` discovery, and no OpenAPM §5 R/W surface. Motivation: see `proposal.md`. Normative checklist: `.samples/apm-knowledge/topics/m2-lockfile-acceptance.md`. Behavior: delta specs `lockfile-dual-file-discovery` and `lockfile-yaml-rw`. Targets remain out of band per `target-package-architecture` — M2 does not scaffold or call adapters.

## Goals / Non-Goals

**Goals:**

- Implement dual-discovery + parse/validate/serialize/round-trip in `@bapm/core` as the M2 public surface for later acceptance
- Prefer OpenAPM wire rules where APM diverges (sort `(repo_url, virtual_path)`; monotonic `"2"`; hash envelopes)
- Reuse M1 YAML safe-subset loader; mirror M1 discovery matrix pattern for lock filenames
- Preserve unknown fields (including APM `deployments` / `lsp_*` / MCP top-level lists) without first-class M2 modeling

**Non-Goals (design-level):**

- Resolve / download / install / frozen CI / deploy / full `lock` CLI pipeline
- Legacy `apm.lock` migration
- First-class target packages or in-core adapters
- Claiming full OpenAPM Consumer class (needs M3–M6)
- Parent-directory walk for lockfiles
- Merging or preferring one brand when both lockfiles exist

## Decisions

### 1. Primary surface is `@bapm/core` API, not CLI

- **Choice:** Export discovery + load/parse/serialize/write from `@bapm/core`. Acceptance calls core (fixtures under `packages/core/tests/acceptance/…` in a later phase). Thin CLI dump/load is optional and not required to close M2.
- **Why:** Matches M1 “core first”; avoids FEOD CLI work in M2.
- **Alternatives:** CLI-only lock doctor — rejected (harder TDD, unnecessary for R/W library).

### 2. Public API shape (recommended symbols)

- **Choice:**
  - Constants: `APM_LOCK_FILE = "apm.lock.yaml"`, keep/align `BAPM_LOCK_FILE = "bapm.lock.yaml"`
  - `discoverLockfilePath(options?: { cwd?: string; path?: string })` → `{ path, filename }` or typed error
  - `loadLockfile(options?)` → validated model + `sourcePath` / `sourceFilename` (strict; not-found errors)
  - `loadLockfileOrNull(options?)` → model | null (APM `LockFile.read` style)
  - `parseLockfile` / `parseLockfileDocument` for YAML string or already-loaded JS value
  - `serializeLockfile(model)` → YAML string
  - `writeLockfile(model, options?)` — write-back same loaded name; fresh create → `bapm.lock.yaml` unless `path` set
  - `isSemanticallyEquivalent(a, b)`
- **Why:** Separates discovery, parse, and write for acceptance checklist C; mirrors M1 + APM nullable read.
- **Alternatives:** Single monolithic `load` only — weaker isolation for dual-conflict vs format errors.

### 3. Version policy: APM default on read, OpenAPM monotonic on write

- **Choice:** Absent `lockfile_version` → default `"1"` on read; always emit version on write; never demote `"2"`→`"1"`; force `"2"` when any `source: registry`; MAY bump to `"2"` for git-semver fields (APM-compatible) without violating OpenAPM.
- **Why:** Closes expert gap; drop-in for legacy pre-versioned locks; stricter-than-APM demotion for OpenAPM claim.
- **Alternatives:** Strict reject if version absent — rejected (breaks APM legacy files).

### 4. Sort and equivalence follow OpenAPM, not APM emit order

- **Choice:** Emit deps sorted by `(repo_url, virtual_path)`; equivalence ignores `generated_at` / `apm_version`. Do not use APM `(depth, repo_url)` as primary sort.
- **Why:** OpenAPM req-lk-005 wire claim; documented APM≠OpenAPM gap.
- **Alternatives:** Match APM sort for byte-identical rewrite of APM locks — rejected for M2 OpenAPM preference (semantic equivalence covers metadata; order is normative for writers).

### 5. Unknown-field preserve; no first-class deployments/LSP in M2

- **Choice:** Retain unknown top-level and per-entry fields (and `x-*`) on the model; round-trip them. Do not model `deployments` / `lsp_*` / MCP server lists as required typed APIs in M2 unless trivial bag retention already covers them.
- **Why:** Expert recommendation; enough for drop-in load of real APM locks without productizing deploy ledger.
- **Alternatives:** Full typed deployments ledger — deferred past M2.

### 6. Hash normalize on the R/W boundary

- **Choice:** Normalize bare 64-hex → `sha256:<hex>` on read; emit envelopes on write for hash fields the serializer owns. Do not verify archive contents in M2.
- **Why:** req-lk-016 writers MUST; accept bare hex for APM-on-disk variety.
- **Alternatives:** Pass-through bare hex on write — rejected (fails OpenAPM writer MUST).

### 7. Self-entry handling mirrors APM

- **Choice:** Flat `local_deployed_*` on disk; optional in-memory self key; never emit self into `dependencies`.
- **Why:** OpenAPM §5.3 / APM `_SELF_KEY` behavior; acceptance checklist item 14.
- **Alternatives:** Represent self only as a dependencies entry — rejected (wire break).

### 8. YAML loader reuse

- **Choice:** Reuse M1 safe-subset YAML load (reject anchors/aliases/custom tags). No second YAML stack for lockfiles.
- **Why:** One policy, less surface; lockfiles are YAML documents like manifests.
- **Alternatives:** Permissive loader matching APM `load_yaml_str` only — rejected for consistency with M1 OpenAPM-strict stance.

### 9. Error model

- **Choice:** Typed errors/codes for: not-found, dual-conflict (both paths named), explicit missing path, format/container errors, unsupported version, entry shape failures (field path + message). Nullable API returns null only for absence, not for corrupt files (corrupt still throws).
- **Why:** Acceptance can distinguish discovery vs validate failures; matches APM “missing → None, corrupt → raise” spirit.

### 10. Fixtures strategy (for later acceptance phase)

- **Choice:** Port OpenAPM lock fixtures (`v1-git-only`, `v2-with-registry`, `round-trip-unknown-fields`, `materialization-sort-exclusion`) into core acceptance fixtures; optionally load real `.samples/apm/apm.lock.yaml` when clone present.
- **Why:** `.samples/` is gitignored; CI must not depend solely on local APM clone.
- **Note:** This design change does not author acceptance tests; apply/acceptance phases own them.

### 11. Targets boundary

- **Choice:** No lockfile APIs import or register `bapm-target-*`; no adapter scaffolding in this change.
- **Why:** Explicit product lock in `target-package-architecture`; M2 scope is R/W only.

## Risks / Trade-offs

- **[Risk] OpenAPM sort ≠ APM emit order** → Rewriting an APM-produced lock may reorder deps → **Mitigation:** Document intentional OpenAPM sort; use semantic equivalence (not raw byte equality) for “same lock” checks.
- **[Risk] Monotonic v2 stricter than APM** → After removing registry entries APM may write `"1"` while bapm keeps `"2"` → **Mitigation:** Document gap; prefer OpenAPM for wire claim.
- **[Risk] Real APM locks carry large unknown/MCP/deploy blocks** → Model bloat if deeply typed → **Mitigation:** Opaque preserve bag for unknowns in M2.
- **[Risk] Scope creep into resolve/install** → **Mitigation:** Explicit non-goals; accept deferred field shapes without runtime verify.
- **[Risk] `.samples/apm` missing in CI** → Real-file e2e skipped → **Mitigation:** Vendored fixtures for MUST cases (acceptance phase).

## Migration Plan

- Additive APIs in `@bapm/core`; existing `BAPM_LOCK_FILE` remains; add `APM_LOCK_FILE`.
- No on-disk migration of user projects in M2 (no rename `apm`↔`bapm`; no legacy `apm.lock`).
- Rollback: remove/stop exporting new lockfile APIs; no schema migration required.

## Open Questions

- Exact export names (`parseLockfile` vs `parseLockfileDocument`) — finalize to FEOD/public-API taste during apply; behavior is fixed by specs.
- How deep to type optional MCP list fields vs pure unknown bag — default unknown bag unless cheap typed accept appears during apply.
