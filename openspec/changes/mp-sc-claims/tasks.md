## 1. Acceptance (RED) — honesty guards

- [x] 1.1 Add Vitest under `packages/core/tests/acceptance/mp-sc-claims/` that loads Mode B `checklist.yml` and asserts: `req-sc-001` / `007` / `009` are `active` with non-empty citations; citation paths resolve on disk
- [x] 1.2 Assert the ten IDs (`002`–`006`, `008`, `010`–`013`) are `skipped` and none of their rationales match the stale marketplace/plugin catch-all (`/marketplace|plugin.*deferred|Out of scope for P3: marketplace/i` or equivalent)
- [x] 1.3 Assert checklist `limitations` / `scope_out` (and/or generated CONFORMANCE Limitations / Scope out) do not treat marketplace/plugin as absolute OOS explaining `sc-*` skips; expect residual security-depth / approve / hosts-auth wording after apply
- [x] 1.4 Assert `apps/docs/guide/conformance.md` does not list marketplace/plugin as absolute OOS after apply (phrase-level guard aligned with docs delta)
- [x] 1.5 Confirm suite fails on current tree (TDD RED) before checklist/docs edits

## 2. Checklist honesty edits (G1–G2)

- [x] 2.1 In `tests/spec-conformance/checklist.yml`, replace rationales for all ten skipped `req-sc-*` with Soft/Deferred themes from design §3 (no marketplace catch-all)
- [x] 2.2 Leave `req-sc-001`, `req-sc-007`, `req-sc-009` status/citations unchanged
- [x] 2.3 Rewrite checklist `limitations` and `scope_out`: remove absolute marketplace/plugin OOS; keep multi-target, registry host, approve/deny UX, and accurate residual §10 security deferrals; rephrase any line that still implies marketplace floor is absent

## 3. Regenerate statement (G3)

- [x] 3.1 Run `pnpm run conformance:gen` (edit checklist only — do not hand-edit `CONFORMANCE.md` / `CONFORMANCE.json`)
- [x] 3.2 Run `pnpm run conformance:check` and keep green
- [x] 3.3 Spot-check generated Limitations / Scope out / waivers: marketplace not absolute OOS; ten `sc-*` skipped with new rationales; actives sc-001/007/009 unchanged

## 4. Docs alignment

- [x] 4.1 Update `apps/docs/guide/conformance.md` Out of scope section to match regenerated Limitations (drop absolute marketplace/plugin; disclose residual §10 security-depth deferrals)
- [x] 4.2 Grep root README / other docs for absolute «marketplace/plugin out of scope»; fix only if still contradicting CONFORMANCE

## 5. Verify DoD / no scope creep (G4–G5)

- [x] 5.1 Re-run `mp-sc-claims` acceptance — GREEN; claim list empty (no new `active` among the ten)
- [x] 5.2 Confirm no production security implementation (no sc-002/sc-006 code, no `mp-hosts-auth`, no approve UX)
- [x] 5.3 Optional knowledge note: mark `mp-sc-claims` done only after accept+archive; next = `mp-hosts-auth` and/or implement-then-claim sc-002/sc-006 (`.samples/` — apply/operators, not plan commit)
