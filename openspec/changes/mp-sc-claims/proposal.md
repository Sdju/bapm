## Why

Marketplace floor (consumer→find→plugin→authoring→pack) has shipped, but Mode B still batch-skips ten OpenAPM `req-sc-*` requirements under the stale P3 rationale «marketplace / plugin / soft extras deferred». That rationale is false: marketplace is orthogonal to §10 security depth. Honesty requires refreshed skipped rationales, Limitations/Scope-out that no longer list marketplace/plugin as absolute OOS, and zero new `active` claims without Mode B citations.

## What Changes

- Refresh checklist rationales for **all ten** skipped `req-sc-*` (`002`–`006`, `008`, `010`–`013`) with security-depth / soft / DEFER themes; delete the marketplace catch-all.
- Leave already-active `req-sc-001`, `req-sc-007`, `req-sc-009` unchanged (citations intact).
- **Claim list remains empty** — no flip of skipped `sc-*` to `active` in this slice.
- Rewrite checklist `limitations` / `scope_out` (and generated CONFORMANCE Limitations / Scope out / waivers) so marketplace floor is acknowledged; residual skips are host-auth, approve UX, soft archive/format gaps — not «marketplace deferred».
- Regenerate `CONFORMANCE.md` + `CONFORMANCE.json` **only** via `conformance:gen`; `conformance:check` must pass (no hand-edit of generated artifacts).
- Align docs guide `/guide/conformance` out-of-scope list with the new Limitations (remove blanket marketplace/plugin OOS).
- Add acceptance (or checklist-adjacent Mode B assert) that documents the expected skipped `sc-*` set, zero unexpected actives, and green gen/check.
- **Non-goals:** implementing sc-002/sc-006 (or any SHOULD claim-later work); `mp-hosts-auth` / AuthResolver; approve/deny UX; activating any `sc-*` without new fixtures/citations; multi-target `tg-*`; registry host `rg-001`.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `openapm-conformance-statement`: After marketplace floor, skipped `req-sc-*` MUST carry refined security-depth rationales (not marketplace catch-all); Limitations/Scope-out MUST NOT list marketplace/plugin as absolute out-of-scope; claim list for this honesty pass stays empty; regenerate-only statement path; acceptance guards the skipped set and zero false actives.
- `docs-openapm-boundary`: Dedicated conformance guide MUST align out-of-scope wording with CONFORMANCE Limitations — marketplace floor exists; residual §10 security skips are not framed as marketplace/plugin OOS.

## Impact

- `tests/spec-conformance/checklist.yml` (source of truth for limitations, scope_out, sc-* rationales).
- Generated root `CONFORMANCE.md` / `CONFORMANCE.json` via project scripts (`pnpm run conformance:gen` / `conformance:check`).
- Docs: `apps/docs/guide/conformance.md` (and any README Limitations echo if still claiming marketplace OOS).
- New acceptance under `**/mp-sc-claims/` (or checklist-adjacent Mode B) asserting skipped IDs + unchanged actives + gen/check green.
- No production runtime / security implementation in this honesty floor; follow-ons: `mp-hosts-auth`, optional implement-then-claim sc-002/sc-006.
