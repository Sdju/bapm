## 1. Canonical tree hash helper

- [ ] 1.1 Reconcile WIP `packages/core/src/modules/Lockfile/treeSha256.ts` (`computeCanonicalTreeSha256`, `.git` exclusion, modes, envelope `sha256:<hex>`); fill any §5.6.4 gaps
- [ ] 1.2 Add unit tests for file/dir/symlink/exec modes, `.git` exclusion, and determinism
- [ ] 1.3 Export helper + violation types/formatters from Lockfile public API (`index` / package surface)

## 2. Record on lock write

- [ ] 2.1 Enrich git entries in `buildLockDocument` / `resolveAndLock` after download using `packageRoot` (git-literal and git-semver)
- [ ] 2.2 Fail closed if git package tree missing or hash compute fails
- [ ] 2.3 Extend resolve/lock unit or e2e test asserting `tree_sha256` present and matches recompute

## 3. Verify on audit + frozen

- [ ] 3.1 Add `collectTreeSha256Violations` (or equivalent) shared helper locating modules trees for git lock entries
- [ ] 3.2 Wire into `runAuditCi` — missing/mismatch/missing-tree fails CI (remove soft M6 skip)
- [ ] 3.3 Wire into frozen install path alongside deployed-hash verify
- [ ] 3.4 Invert audit test §21 (missing `tree_sha256` MUST fail); add mismatch + match cases; add frozen mismatch/missing tests

## 4. Docs / soft notes

- [ ] 4.1 Update Resolver/Audit READMEs or soft notes: lk-015 now enforced; `.git` exclusion
- [ ] 4.2 Run core unit tests for Lockfile/Audit/Install/Resolver affected suites
