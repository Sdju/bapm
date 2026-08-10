## Context

`@b-apm/core` today exports a stub `parseManifest(input: unknown)` that validates only `name`/`version` on a pre-parsed object, plus constants `BAPM_MANIFEST_FILE = "bapm.yml"` / `BAPM_LOCK_FILE`. There is no YAML dependency, no filesystem discovery, and no OpenAPM-aligned dep/registry validation. Motivation and product scope: see `proposal.md`. Normative acceptance checklist: `.samples/apm-knowledge/topics/m1-manifest-acceptance.md`. Behavior contracts: delta specs `manifest-dual-file-discovery` and `manifest-yaml-validate`.

## Goals / Non-Goals

**Goals:**

- Implement discovery + YAML load + validate in `@b-apm/core` as the M1 public surface for acceptance tests
- Keep API small and testable without requiring FEOD CLI work
- Match OpenAPM Consumer/Producer parse baseline listed in the proposal (mf-001..004, 007..012, 014..015 if registries, 019..021, ext-002; anchors/aliases reject)
- Record loaded filename on the result for future same-path write-back

**Non-Goals (design-level):**

- Serialize/rewrite round-trip (mf-006 / ext-001 preserve-on-write) — document only
- Choosing FEOD layout for CLI commands
- Package FS validation (`.apm/` tree)
- Walking up from cwd for manifests
- Merging or preferring one brand file when both exist

## Decisions

### 1. Primary surface is `@b-apm/core` API, not CLI

- **Choice:** Export discovery + load/validate from `@b-apm/core`. Acceptance and e2e call core (fixtures under `packages/core/tests/acceptance/m1-manifest-yaml-dual-read/`). Thin CLI is optional and out of M1 MUST.
- **Why:** Unblocks lock/resolve later without coupling M1 to FEOD CLI structure; matches roadmap “core first”.
- **Alternatives:** CLI-only doctor command — rejected for M1 (harder TDD, unnecessary FEOD work).

### 2. Public API shape (names locked for M1)

- **Choice:**
  - `discoverManifestPath(options?: { cwd?: string; path?: string })` → `{ path, filename: "apm.yml" | "bapm.yml" }` or typed error
  - `loadManifest(options?: { cwd?: string; path?: string })` → validated document + `sourcePath` / `sourceFilename` + optional warnings
  - `parseManifestDocument(raw: unknown)` / keep evolving `parseManifest` for already-loaded JS values (YAML bytes go through load)
- **Why:** Separates discovery from validate for unit tests; mirrors APM “cwd + optional path” without walk-up.
- **Alternatives:** Single `loadManifest` only — weaker for testing discovery matrix in isolation.

### 3. In-memory model retains unknowns

- **Choice:** Validated result includes known typed fields **and** a bag (or full document map) retaining unknown top-level keys and `x-*`. Do not strip on read.
- **Why:** Enables future mf-006 rewrite without a second parse; satisfies read-side ext-001.
- **Alternatives:** Strip unknowns like current APM `APMPackage` field copy — rejected for bapm (would lose extension data before rewrite exists).

### 4. YAML library and safe-subset

- **Choice:** Add a YAML parser via pnpm catalog (prefer a maintained safe/default-schema library; pin in workspace catalog). Reject anchors/aliases/custom tags in a dedicated guard (pre-scan or loader hooks) even if the library would expand them.
- **Why:** OpenAPM req-mf-020; intentional stricter-than-APM-loader behavior for conformance claim.
- **Alternatives:** Match APM `_BoundedSafeLoader` allow-with-budget — rejected for M1 wire claim.

### 5. Error model

- **Choice:** Typed errors (or error codes) for: missing file, dual-file conflict (both paths named), invalid YAML, validation failures (field path + message). Map closely enough that acceptance assertions can check codes/messages without brittle full-string equality where possible.
- **Why:** Dual-conflict and validation are distinct product diagnostics.

### 6. Fixtures strategy

- **Choice:** Port/copy OpenAPM seed fixtures into acceptance (or reference `.samples/apm/...` when present). E2E also loads real `.samples/apm/apm.yml` when the sample clone exists; tests SHOULD skip or soft-fail clearly if `.samples/apm` is absent (gitignored), with copied fixtures covering CI.
- **Why:** `.samples/` is gitignored; CI must not depend solely on a local APM clone.

### 7. Constants

- **Choice:** Export both `APM_MANIFEST_FILE = "apm.yml"` and keep `BAPM_MANIFEST_FILE = "bapm.yml"`. Discovery uses both.
- **Why:** Drop-in naming clarity for callers and diagnostics.

### 8. Dependency / registry validation depth in M1

- **Choice:** Validate shapes needed by listed OpenAPM reqs and APM `from_apm_yml` parse-time rules (mapping deps, string/object entries, one source discriminator with `path` companion to `git` / required for `git: parent`, `registries.default` as name pointer, allowlisted dep meta `alias`/`skills`, registries https + unknown keys / token-in-YAML if APM rejects). Do not resolve `git: parent`, marketplace, MCP env templates, or absolute-path policy (mf-016 deferred).
- **Why:** Keeps M1 bounded while matching acceptance checklist.

## Risks / Trade-offs

- **[Risk] Stricter-than-APM on anchors** → Some APM-valid-in-practice files may fail in bapm → **Mitigation:** Document intentional OpenAPM-strict policy in API docs / knowledge topic; fixture `invalid-yaml-anchor-alias.yml` asserts reject.
- **[Risk] `.samples/apm` missing in CI** → Real-file e2e skipped → **Mitigation:** Vendored/copied fixtures under `packages/core/tests/.../fixtures` for MUST cases; real sample is additional when present.
- **[Risk] YAML library YAML 1.1 quirks (octal, etc.)** → Surprise coercions → **Mitigation:** Prefer string-preserving load settings; add tests for numeric version reject; reject custom tags.
- **[Risk] Scope creep into rewrite** → **Mitigation:** Explicit non-goal; retain unknowns only; no write API in tasks.

## Migration Plan

- Additive API in `@b-apm/core`; existing stub `parseManifest` either gains full validation (compatible for valid minimal objects) or is superseded by documented `loadManifest` / `parseManifestDocument` with re-export alias—prefer strengthening `parseManifest` for object input and adding `loadManifest` for FS/YAML without breaking the minimal happy path.
- No lockfile/CLI migration in M1.
- Rollback: revert the change; no data format written by M1.

## Open Questions

- Exact warning channel for mf-004 semver (return-field vs event) — implementer choice; must not fail load.
- Whether `devDependencies` list-key parsing mirrors `dependencies` fully in M1 (MUST validate mapping; deep entry parity SHOULD match `dependencies`).
