## Context

See proposal.md — Why. Marketplace phases shipped; Mode B still marks ten `req-sc-*` skipped with P3 catch-all «marketplace / plugin / soft extras deferred», and Limitations/Scope-out still list marketplace/plugin as absolute OOS. Criteria locked: `.samples/apm-knowledge/topics/mp-sc-claims-criteria.md` (claim list empty; G1–G5 honesty floor only).

Source of truth: `tests/spec-conformance/checklist.yml` → `pnpm run conformance:gen` → root `CONFORMANCE.md` / `CONFORMANCE.json`; drift via `conformance:check`. Docs echo: `apps/docs/guide/conformance.md`.

## Goals / Non-Goals

**Goals:**

- Refresh ten skipped `sc-*` rationales to criteria themes; keep sc-001/007/009 active unchanged.
- Rewrite checklist limitations/scope_out so marketplace floor is not absolute OOS; residual = security-depth / soft / DEFER.
- Regenerate statement; drift gate green; zero false actives.
- Align `/guide/conformance` out-of-scope with new Limitations.
- Acceptance under `**/mp-sc-claims/` that locks skipped set + actives + gen/check posture.

**Non-Goals:**

- Implementing sc-002/sc-006 or any SHOULD claim-later work in this slice.
- `mp-hosts-auth` / AuthResolver / enterprise hosts.
- Approve/deny interactive UX (sc-010..012).
- Flipping any skipped `sc-*` to `active`.
- Hand-editing generated CONFORMANCE artifacts.
- Multi-target `tg-*`, registry host `rg-001`.

## Decisions

### 1. Honesty floor only — empty claim list

- **Choice:** Do not activate any skipped `sc-*`. Optional SHOULD (symlink zip-slip, `insecure` http gate) deferred to later changes.
- **Rationale:** Criteria D1/MUST 5; marketplace evidence ≠ §10 Mode B coverage. False actives forbidden.
- **Alternatives considered:** Fold sc-002/sc-006 implement-then-claim into same change — rejected (locked criteria: G1–G5 only).

### 2. Checklist-only edits + generator path

- **Choice:** Edit `tests/spec-conformance/checklist.yml` (limitations, scope_out, ten rationales). Run `pnpm run conformance:gen` then `conformance:check`. Never hand-patch `CONFORMANCE.md`/`json`.
- **Rationale:** Criteria D4 / MUST 3–4; existing drift gate already owned by p3 harness.
- **Alternatives:** Patch CONFORMANCE.md directly — rejected (breaks drift).

### 3. Rationale text targets (locked themes)

| ID | Theme |
|----|--------|
| sc-002 | Soft: partial path-escape on zip extract; full zip-slip + symlink/hardlink + sc-004 caps not claimed |
| sc-003 | Deferred: cross-host-class credential scoping / redirect Auth drop (`mp-hosts-auth`) |
| sc-004 | Soft: registry archives are zip; OpenAPM tar.gz-only + size/entry caps not claimed |
| sc-005 | Deferred: credential host-class = PSL eTLD+1 / aliases not wired on fetch path |
| sc-006 | Deferred: `registries.*.insecure` + http parse gate not implemented |
| sc-008 | SHOULD deferred: non-https git-HTTP credential refuse not claimed |
| sc-010 | Deferred: no interactive approve / user-local grant store |
| sc-011 | Deferred: org-policy executable deny-wins + install/audit parity not claimed |
| sc-012 | Deferred: required-package vs withheld-executable audit fidelity not claimed |
| sc-013 | Deferred: operator host-class overlap + ambient credential suppress not claimed |

Exact checklist strings MAY be slightly shorter but MUST preserve Soft/Deferred distinction and MUST NOT mention marketplace catch-all.

### 4. Limitations / scope_out rewrite

- **Choice:** Remove «Marketplace / plugin surfaces are out of scope» and scope_out token `marketplace/plugin` as absolute. Replace with residual items such as: host-class credential scoping / AuthResolver follow-up; approve/deny UX; soft §10 archive format/caps; keep multi-target, registry host, full ADO cascade, full Python Mode B port as still OOS where accurate. Drop or rephrase «ADO / multi-candidate… and marketplace/plugin governance UX» so marketplace floor is not implied absent — keep approve/deny UX OOS.
- **Rationale:** Criteria D3; marketplace CLI exists; sc skips are security-depth gaps.
- **Alternatives:** Leave marketplace in scope_out «until feature-complete» — rejected (criteria: not absolute OOS).

### 5. Docs alignment

- **Choice:** Update `apps/docs/guide/conformance.md` Out of scope list to match regenerated Limitations (drop absolute marketplace/plugin; disclose residual §10 security deferrals). Touch README only if it still claims marketplace OOS (verify in apply).
- **Rationale:** `docs-openapm-boundary` still requires alignment with Limitations; current guide hard-codes marketplace OOS.
- **Alternatives:** Docs-only note without checklist change — rejected (statement would still lie).

### 6. Acceptance shape

- **Choice:** Vitest under `packages/core/tests/acceptance/mp-sc-claims/` (preferred) reading checklist (+ optionally CONFORMANCE.md / guide page):
  - sc-001/007/009 = `active` with citation present
  - ten IDs = `skipped`
  - skipped rationales must not match marketplace/plugin catch-all
  - limitations/scope_out must not treat marketplace/plugin as absolute OOS for sc
  - optional: assert `conformance:check` script exists / can be invoked, or rely on existing drift-gate tests + apply task that runs check
- **Rationale:** Criteria MUST 7; TDD RED before apply edits checklist.
- **Alternatives:** Only extend `checklist.test.ts` in place — weaker change isolation; still acceptable if acceptance agent prefers, but prefer dedicated `mp-sc-claims/` folder.

### 7. Citation verify (G5)

- **Choice:** Acceptance or apply smoke: resolve citation paths for sc-001/007/009 (files exist). Do not rewrite citations unless broken.
- **Rationale:** Criteria MUST 6 / G5.

## Risks / Trade-offs

- **Over-narrow Limitations** omit a real residual → Mitigation: mirror criteria D3 themes; keep approve/deny and hosts-auth named.
- **Accidental active flip** during checklist edit → Mitigation: acceptance locks ten IDs skipped; claim list empty in DoD.
- **Docs/statement mismatch** → Mitigation: regenerate first, then copy Limitations language into guide.
- **SHOULD scope creep** (implement sc-002/006) → Mitigation: explicit non-goal; defer to later OpenSpec changes.

## Migration Plan

1. Acceptance RED: assert expected statuses/rationales/Limitations honesty (fails on current checklist).
2. Apply: edit checklist.yml → `conformance:gen` → `conformance:check` → update guide page → confirm actives unchanged.
3. Accept → promote → merge; archive when orch completes.
4. Next roadmap calls: `mp-hosts-auth` and/or implement-then-claim sc-002/sc-006 — not this change.

## Open Questions

_None deferrable — product call «honesty floor only» locked by criteria; sc-004 zip soft-skip and hosts-auth deferral already decided._
