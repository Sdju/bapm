## Why

OpenAPM v0.1 **req-lk-015** (MUST, Consumer) requires every git-sourced lock entry to carry a canonical `tree_sha256`, and to re-verify it on frozen install and `audit`. After M1–M10, bapm still treats `tree_sha256` as soft/optional, which blocks an honest full Consumer claim and was the top gap in the post-M10 parity report. Multi-host targets are explicitly out of scope for this change (later).

## What Changes

- Compute and record OpenAPM §5.6.4 canonical `tree_sha256` (`sha256:<hex>`) for every **git-sourced** lockfile entry when writing the lock (resolve/lock/install non-frozen paths that emit pins).
- On **frozen install** and **`bapm audit` / `audit --ci`**: re-compute from the on-disk package tree and **fail closed** on mismatch (diagnostic: entry, expected, observed).
- Treat **missing** `tree_sha256` on git-sourced entries as a CI/frozen failure (closes the M6 soft gap).
- **Non-goals:** multi-target adapters; marketplace/plugin; registry host; local-path `content_hash` (OpenAPM v0.2); SARIF/full APM drift suite; lk-018 CI-default frozen (next stage); formal Mode B / CONFORMANCE.md (later stage).

## Capabilities

### New Capabilities

- `tree-sha256-integrity`: Canonical git-tree SHA-256 compute/record/re-verify per OpenAPM §5.6.4 / req-lk-015.

### Modified Capabilities

- `dependency-resolve`: Git pins MUST include computed `tree_sha256` when writing lock (no longer MAY omit).
- `audit-integrity`: Replace M6 soft rule — missing or mismatched `tree_sha256` on git entries MUST fail `audit --ci`.
- `install-pipeline`: Frozen install MUST re-verify recorded `tree_sha256` and fail closed on mismatch/absence for git-sourced entries.

## Impact

- `@bapm/core`: finish/export WIP `Lockfile/treeSha256.ts`; wire `resolveAndLock` / install lock write; `runAuditCi`; frozen install verify.
- Unit/acceptance tests that currently assert “missing tree_sha256 does not fail” must invert.
- CLI surface unchanged (behavior of `install --frozen` / `audit --ci` tightens).
- Follow-on stages (not this change): P2 lk-018, P3 Mode B/CONFORMANCE, P4 Governance remote/extends, P5 docs boundary; multi-target later.
- **Out of scope:** multi-target adapters (later).
