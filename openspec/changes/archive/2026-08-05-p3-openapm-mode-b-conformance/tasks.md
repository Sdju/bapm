## 1. Vendor OpenAPM seed assets

- [x] 1.1 Copy OpenAPM §12.4 seed tree from `.samples/apm/tests/fixtures/spec-conformance/` into `tests/fixtures/spec-conformance/` (manifest, lockfile, policy, resolution, README) with provenance note (spec v0.1 / APM path)
- [x] 1.2 Vendor informative `openapm-v0.1.requirements.yml` mirror under `tests/spec-conformance/` (from APM `docs/public/specs/manifests/`) for checklist generation without `.samples`

## 2. Checklist and claim triage

- [x] 2.1 Create machine-readable checklist (YAML/JSON) enumerating all requirements from the mirror with fields: id, class, keyword, status (`active`|`skipped`|`n/a`), fixture path(s), assertion/test citation, waiver rationale
- [x] 2.2 Triage claim posture: Consumer/Producer → claim candidates; Governance remote/`extends` → skipped; Registry/rg-001 → `n/a`; multi-target/marketplace/plugin → not claimed; document intentional OpenAPM-vs-APM diffs as limitations not passes
- [x] 2.3 Map existing `packages/*/tests` evidence onto checklist rows where coverage already exists (M1–M10/P1/P2); leave gaps for new Vitest work

## 3. Mode B Vitest harness

- [x] 3.1 Add Vitest modules under `packages/core/tests/spec-conformance/` (or repo `tests/spec-conformance/` if `vp` globs prefer) loading fixtures from `tests/fixtures/spec-conformance/`
- [x] 3.2 Implement req-cf-001 idempotent round-trip tests for seed manifest and lockfile fixtures (including `x-*` / unknown-field fixtures); document branding cosmetics in statement limitations if writer defaults differ
- [x] 3.3 Add fixture-driven tests for seed valid/invalid oracles not already covered (manifest reject cases, lockfile seed cases, policy fixtures only where local-floor claim applies; skip extends-cycle as Governance skipped if not implemented)
- [x] 3.4 Wire semver-dialect oracle (`resolution/semver-dialect.json`) to resolver coverage or explicit skipped with rationale if already covered elsewhere
- [x] 3.5 Ensure every checklist `active` row cites a concrete test file/assertion after this section

## 4. Statement generation and publish

- [x] 4.1 Add generator script that reads checklist (+ optional coverage metadata) and emits deterministic `CONFORMANCE.md` and `CONFORMANCE.json` at repo root (classes, v0.1, optional features, limitations, per-req table, waivers)
- [x] 4.2 Generate and commit initial statement with honesty contract: Consumer + Producer claimed; Governance floor with remote/`extends` skipped; Registry N/A
- [x] 4.3 Add `vp`/package script to regenerate statement; document invocation in script header or short README under `tests/spec-conformance/`

## 5. Drift gate and verification

- [x] 5.1 Add check that regenerates statement and fails on `git diff` against committed `CONFORMANCE.md` / `CONFORMANCE.json` (CI job or existing workflow step)
- [x] 5.2 Run Mode B Vitest suite + drift check locally; fix only bugs required for honest active claims (no scope expansion)
- [x] 5.3 Confirm `openspec validate --strict` still clean for this change after any task-doc tweaks; no production feature invention for unsupported reqs
