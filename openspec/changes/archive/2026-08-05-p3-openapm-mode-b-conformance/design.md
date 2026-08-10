## Context

See `proposal.md` for motivation. After M1–M10 + P1/P2, bapm already has domain coverage in `packages/*/tests` and OpenSpec capabilities, but no OpenAPM §11–12 published claim. APM reference: `.samples/apm/CONFORMANCE.md`, `tests/spec_conformance/`, `tests/fixtures/spec-conformance/`, informative `openapm-v0.1.requirements.yml`. `.samples/` is gitignored — fixtures must be vendored.

OpenAPM “Mode B” here means the **hybrid fixture-anchored + statement-anchored** methodology (§12), especially **req-cf-001** (round-trip) and **req-cf-002** (published statement citing fixtures/assertions). APM’s `mode_b_detector.sh` (silent-extension PR gate) is **out of scope** for this stage unless a thin optional follow-up is trivial; do not block P3 on porting that script.

## Goals / Non-Goals

**Goals:**

- Vendor OpenAPM v0.1 seed fixtures into git.
- Ship a Vitest Mode B harness (or req-ID checklist bound to fixtures + existing tests) covering claimed classes.
- Prove cf-001 round-trip on seed manifest/lockfile fixtures via `@b-apm/core` parse/serialize.
- Publish honest `CONFORMANCE.md` (+ `CONFORMANCE.json`) for Consumer, Producer, Governance floor; Registry N/A.
- Add a drift check so the statement stays tied to coverage.

**Non-Goals:**

- Full line-by-line Python→TS port of every APM `test_*_reqs.py` module.
- Implementing P4 remote/`extends`, multi-target adapters, marketplace/plugin, registry host.
- Claiming features bapm does not implement.
- Porting APM `orphan_check.py` / Mode B silent-extension detector as a MUST for this change.

## Decisions

### 1. Vendor fixtures at `tests/fixtures/spec-conformance/`

- **Choice:** Copy the OpenAPM §12.4 seed tree (and any extra seed files present in APM that are still part of the published seed set) into repo-root `tests/fixtures/spec-conformance/`, with README noting provenance (OpenAPM/APM path + spec version).
- **Why:** Stable CI path; `.samples` unavailable to consumers/CI by default.
- **Alternatives:** Submodule / runtime clone of microsoft/apm — rejected (fragile, network, version skew). Symlink into `.samples` — rejected (gitignored).

### 2. Hybrid checklist + focused Vitest modules (not full APM suite clone)

- **Choice:**
  1. **Machine checklist** (YAML/JSON) listing every Appendix C / requirements.yml `req-XXX` for claimed classes with status (`active` | `skipped` | `n/a`), fixture path(s), and test id / file reference.
  2. **New Vitest modules** for fixture-driven cases that are not already covered (especially cf-001 round-trip, seed valid/invalid manifest/lockfile/policy oracles, semver-dialect table where applicable).
  3. **Reuse** existing `packages/core/tests/**` (and CLI where needed) by citing them in the checklist for reqs already proven in M1–M10/P1/P2.
- **Why:** Meets cf-002 “cite fixture + assertion” without a multi-week port; honesty via explicit skipped/N/A.
- **Alternatives:** Full pytest reimplementation — deferred; run APM pytest against bapm — infeasible (Python API).

### 3. Statement artifacts at repo root

- **Choice:** Commit `CONFORMANCE.md` and `CONFORMANCE.json` at repository root (APM shape). Prefer a small Node script (e.g. `scripts/gen-conformance-statement.mjs` or package under `packages/core`) that reads the checklist + optional Vitest metadata and emits both files deterministically.
- **Why:** Matches OpenAPM/APM consumer expectations; machine-readable for aggregators.
- **Alternatives:** Docs-site-only page — weaker for cf-002 “publish”; hand-only MD without JSON — acceptable fallback if generator slips, but JSON is preferred in the same change.

### 4. Claim matrix (initial publish)

| Class      | Status                    | Notes                                                                                                                                                                   |
| ---------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consumer   | **claim**                 | Primary; waivers for host-matrix items beyond cursor deploy where required; soft notes for intentional OpenAPM-vs-APM diffs (∩-pick, etc.) as limitations, not failures |
| Producer   | **claim**                 | init/pack/pr-004 citations                                                                                                                                              |
| Governance | **floor / limited claim** | Local providers + gate `active`; remote/`extends`-only reqs → `skipped` with P4 rationale                                                                               |
| Registry   | **N/A**                   | No host; do not list rg-001 as claimed                                                                                                                                  |

Copy informative requirements inventory from APM’s `openapm-v0.1.requirements.yml` into e.g. `tests/spec-conformance/openapm-v0.1.requirements.yml` (informative mirror) so the checklist generator does not depend on `.samples`.

### 5. Drift gate

- **Choice:** Script `gen` + `git diff --exit-code CONFORMANCE.md CONFORMANCE.json` (or compare to expected hash) runnable via `vp`/`pnpm` task; wire into existing CI if present, else document as required local/CI step in tasks.
- **Why:** Same honesty contract as APM without Python.

### 6. Dual-read branding vs fixtures

- **Choice:** Seed fixtures use OpenAPM wire names (`apm.yml`, `apm.lock.yaml`, `apm-policy.yml`). bapm dual-read already accepts them. Round-trip MAY canonicalize writer defaults (`bapm.yml` / `bapm.lock.yaml`) only where existing specs already allow; for cf-001, assert fixed-point on the **in-memory document / chosen writer form** consistently and document any filename branding difference in the statement limitations section.
- **Why:** Avoid inventing a second fixture tree; stay honest about branding.

## Risks / Trade-offs

- [Checklist cites flaky or over-broad tests] → Mitigation: prefer narrow fixture tests for seed oracles; citation must name concrete test file + describe assertion.
- [Over-claim Governance] → Mitigation: default remote/`extends` to skipped; statement header says “floor”.
- [Fixture copy drifts from upstream OpenAPM] → Mitigation: README provenance + pin spec version `v0.1`; refresh only with intentional PRs.
- [Round-trip fails on cosmetic YAML] → Mitigation: use core’s canonical writers; document allowed cosmetics per OpenAPM §4.3.4 / §5.2; fix only real preservation bugs if they block claim.
- [Incomplete Consumer MUST coverage discovered] → Mitigation: mark `skipped` with rationale rather than fake `active`; do not expand product scope in P3.

## Migration Plan

1. Vendor fixtures + requirements mirror.
2. Add checklist skeleton (all reqs → triage status).
3. Implement cf-001 Vitest + fill active citations from existing suites.
4. Generate and commit CONFORMANCE artifacts.
5. Add drift task/CI.
6. No runtime migration for end users; docs link optional.

Rollback: delete statement/fixtures/suite; product behavior unchanged.

## Open Questions

- Exact Vitest package root (`packages/core/tests/spec-conformance` vs repo `tests/spec-conformance`) — decide at apply for path consistency with `vp` test globs; either is fine if checklist paths are absolute-from-repo.
- Whether to auto-collect Vitest `meta.req` markers in v1 of the generator or start checklist-driven only — prefer checklist-first for determinism.
