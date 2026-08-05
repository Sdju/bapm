## 1. Root README boundary

- [ ] 1.1 Add `## Conformance & parity` to root `README.md` (after Структура): link `CONFORMANCE.md` (+ optional `CONFORMANCE.json`); claimed classes Consumer+Producer+Governance, Registry N/A; not drop-in APM CLI; intentional diffs (∩-pick vs first-wins, cursor-only, dual-read)
- [ ] 1.2 Verify README does not claim full microsoft/apm product CLI or multi-client adapter parity

## 2. VitePress dedicated page + nav

- [ ] 2.1 Create `apps/docs/guide/conformance.md` with three axes (OpenAPM v0.1 claim vs APM product CLI vs cursor-only), link to root CONFORMANCE / Limitations, out-of-scope list (multi-target later, marketplace/plugin, registry host)
- [ ] 2.2 Register the page in `apps/docs/.vitepress/config.ts` Guide sidebar (and optional nav)
- [ ] 2.3 Add a short pointer from `apps/docs/architecture/index.md` to the new guide page

## 3. Fix multi-client marketing

- [ ] 3.1 Update `apps/docs/index.md` landing: remove shipped multi-client (Copilot/Claude/…) adapter marketing; state cursor-only + target packages
- [ ] 3.2 Update `apps/docs/guide/index.md` intro similarly (no “across clients” as current fact without cursor-only qualifier)
- [ ] 3.3 Update `apps/docs/architecture/index.md` package diagram text: target packages / cursor-only, not in-tree multi-client adapters inside `@bapm/core`

## 4. CONFORMANCE discoverability (no coverage hand-edit)

- [ ] 4.1 Prefer README + docs page cross-links only; if adding a generator “See also” footer, implement via `scripts/gen-conformance-statement.mjs` constant, regenerate, and do **not** hand-edit coverage tables
- [ ] 4.2 Run `pnpm run conformance:check` (or project equivalent) and keep it green; skip generator change if footer is unnecessary

## 5. Knowledge sync

- [ ] 5.1 Update `.samples/apm-knowledge/topics/parity-gap-roadmap.md`: S5/P5 docs boundary closed after apply; OpenAPM floor track complete; multi-target separate
- [ ] 5.2 Update `.samples/apm-knowledge/topics/bapm-apm-parity-report.md` and `bapm-openapm-conformance.md`: P4 Governance claimed/done; no “floor forever”; P5 = docs boundary only
- [ ] 5.3 Align `p5-docs-boundary-criteria.md` status notes if still saying “next = propose”

## 6. Verify docs-only DoD

- [ ] 6.1 Spot-check: no new CLI commands, Policy features, multi-target packages, or claim-table churn beyond optional generator footer
- [ ] 6.2 Confirm acceptance suite expectations remain docs/link/phrase presence only (orchestrate RED→GREEN)
