## Context

See proposal.md — Why. Today `tree_sha256` is accepted/serialized (M2) but not computed on lock write; audit explicitly soft-skips absence (M6 soft rule in `runAuditCi` / `audit-integrity`). OpenAPM §5.6.4 defines a deterministic canonical-tree SHA-256. Git packages land under `apm_modules/<owner>/<repo>` via Resolver download; `ResolvedNode.packageRoot` points at that tree when present.

**Prior WIP (non-orchestrated):** untracked `packages/core/src/modules/Lockfile/treeSha256.ts` already implements `computeCanonicalTreeSha256` (walk with `.git` skip, modes, envelope), `treeSha256Equal`, and `formatTreeSha256Violation` / `TreeSha256Violation`. It is **not** exported from Lockfile public API and **not** wired into resolve/lock write, frozen install, or `runAuditCi`. Apply MUST reconcile this file (complete/export/wire + tests) rather than invent a parallel helper; do not leave it orphaned.

## Goals / Non-Goals

**Goals:**
- Shared helper: directory → `sha256:<hex>` per §5.6.4 (finish + export the WIP module)
- Enrich git lock entries on `resolveAndLock` / install lock write after download
- Shared verify/`collectTreeSha256Violations` used by frozen install and `runAuditCi`
- Invert M6 soft tests to hard fail

**Non-Goals:**
- Multi-target adapters
- lk-018 CI-default frozen
- Mode B / CONFORMANCE.md
- Governance remote/`extends`
- local-path `content_hash` (OpenAPM v0.2)
- Including `.git` in the hash walk (explicitly excluded — see Decisions)

## Decisions

1. **Module placement:** Put `computeCanonicalTreeSha256(rootDir)` + verify helpers in `packages/core/src/modules/Lockfile/` (hash concerns + public from Lockfile index), called by Resolver lock build and Install/Audit. Prefer completing the existing WIP file over a new parallel path. Alternative considered: Install-only — rejected because `resolveAndLock` also writes locks without full install.
2. **Walk root:** Hash `packageRoot` on disk after download. If a path fragment applies and download already materializes that subdirectory as root, hash that root. Do not hash through parent `apm_modules` unrelated packages.
3. **Exclude `.git`:** Canonical tree for Consumer integrity is the working-tree content of the installed package, not the embedded git database. Alternative: include `.git` — rejected (non-deterministic object packs / clone noise). Document in a future conformance statement.
4. **Modes:** `fs.lstat` — symlink → `120000` + target bytes; directory → recurse `040000`; file → `100755` if any execute bit else `100644`. Unsupported special types → fail-closed error.
5. **Frozen timing:** After `enforceFrozen` pin checks and before durable lock rewrite / after modules presence ensured — verify trees for git entries alongside deployed hash verify (compose with existing `collectDeployedHashViolations` pattern).
6. **Missing modules on audit:** Fail closed (cannot recompute) with diagnostic naming entry.

## Risks / Trade-offs

- [Existing locks without tree_sha256] → Mitigation: one non-frozen `bapm lock` / `install` regenerates; frozen/audit fail until then (intentional).
- [Large trees / perf] → Mitigation: sync walk is fine for agent packages; no parallel required for P1.
- [Windows executable bit] → Mitigation: mode may always be `100644` on platforms without exec bit; document; tests use Unix semantics in CI Linux.
- [Path-filtered virtual packages] → If download already extracts subdirectory as packageRoot, hash that; if full clone + path, prefer hashing the path subdirectory when `path` is set on the node.
- [Orphan WIP file] → Mitigation: apply owns export + wiring; plan artifacts document starting state so acceptance/apply do not diverge.

## Migration Plan

1. Finish helper (export + any gaps) and unit-test algorithm.
2. Enrich lock write; fail closed if compute impossible for git entries.
3. Flip audit/frozen verify on; invert soft M6 tests.
4. Regenerate any in-repo fixture locks that need git tree hashes.
5. Later stages (not this change): P2 lk-018, P3 Mode B, P4 Governance, P5 docs; multi-target later.

## Open Questions

None blocking — `.git` exclusion is an explicit design choice for a future conformance note.
