## Why

After P1–P4, root `CONFORMANCE.md` already claims Consumer+Producer+Governance (Registry N/A), but human-facing surfaces still blur three axes: OpenAPM v0.1 wire conformance, microsoft/apm product CLI parity, and host target matrix. Root README has no CONFORMANCE link; VitePress still markets multi-client adapters. P5 closes that documentation boundary so readers do not overclaim product parity.

## What Changes

- Add a root README section **Conformance & parity**: link `CONFORMANCE.md` (and optionally `CONFORMANCE.json`); state claimed classes; explicit “not a drop-in APM CLI”; intentional diffs (∩-pick vs first-wins, cursor-only, dual-read branding).
- Add a **dedicated VitePress page** `guide/conformance.md` (sidebar + nav), not a buried architecture subsection — three-axis boundary, out-of-scope list aligned with CONFORMANCE Limitations, link to root statement.
- Fix misleading multi-client marketing on landing / guide intro / architecture (cursor-only today; target packages, not in-tree APM adapters).
- Optional generator prologue / “related docs” one-liner only if a slot already exists or can be added without touching coverage tables; never hand-edit claim rows; keep `conformance:check` green.
- Sync `.samples/apm-knowledge` topics (roadmap, parity-report, openapm-conformance): P4 done, Governance claimed, P5 closes docs track; no “floor forever” contradiction.
- Acceptance = docs/link presence (and key phrase snapshots) only — no new CLI/features.

## Capabilities

### New Capabilities

- `docs-openapm-boundary`: Reader-facing documentation that distinguishes OpenAPM v0.1 conformance claims from APM product CLI parity and documents cursor-only host posture, with discoverable links into `CONFORMANCE.md`.

### Modified Capabilities

- (none) — claim posture and Mode B coverage stay as published after P4; this change does not alter `openapm-conformance-statement` requirements.

## Impact

- **In:** Root `README.md`; `apps/docs` (VitePress pages + sidebar config); optional conformance generator note/cross-link without coverage churn; knowledge topics under `.samples/apm-knowledge/`.
- **Out:** APM CLI feature parity (`run`/`preview`/`runtime`/`mcp`/`approve`, marketplace, plugin); multi-target / new `bapm-target-*`; Registry host rg-001; reopening P1–P4 code or flipping Governance; rewriting OpenAPM normative text; changing ∩-pick to APM first-wins; package-level README one-liners (root + docs site suffice).
- **Risk:** Overclaim in marketing copy; stale landing if only README is fixed; hand-editing CONFORMANCE tables.
