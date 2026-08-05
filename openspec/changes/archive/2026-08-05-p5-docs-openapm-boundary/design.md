## Context

See proposal.md — Why. P1–P4 are archived; root `CONFORMANCE.md` already claims Consumer+Producer+Governance (Registry N/A). Gaps are discoverability and marketing honesty: root README has no CONFORMANCE section; VitePress landing/guide/architecture still imply multi-client adapters. Criteria: `.samples/apm-knowledge/topics/p5-docs-boundary-criteria.md`.

## Goals / Non-Goals

**Goals:**

- One discoverable human path: README → CONFORMANCE; docs site → dedicated boundary page → CONFORMANCE Limitations.
- Correct cursor-only + target-package messaging on all primary docs entry points.
- Keep claim tables generator-owned; acceptance = presence of sections/links/phrases only.
- Sync knowledge topics so the floor track closes cleanly after P5.

**Non-Goals:**

- Changing Mode B coverage, claim posture, or Policy/CLI product behavior.
- Implementing multi-target, marketplace/plugin, Registry host, or APM CLI commands.
- Package-level README one-liners (root + VitePress suffice).
- Rewriting OpenAPM normative text or flipping ∩-pick to first-wins.

## Decisions

### 1. Dedicated VitePress page (not architecture subsection)

- **Choice:** Add `apps/docs/guide/conformance.md` and register it in Guide sidebar (and optionally nav). Architecture overview gets a short pointer + corrected target-package wording only.
- **Rationale:** Three-axis boundary needs a stable URL and nav entry; burying it under architecture risks readers missing “not drop-in APM CLI.” Criteria open question resolved at propose.
- **Alternatives considered:** Architecture-only subsection — rejected (weaker discoverability, mixes product boundary with package diagram).

### 2. README language and placement

- **Choice:** Russian section matching existing root README voice; heading `## Conformance & parity` (English product term keeps grep/acceptance stable). Place after Structure / before or after Commands — prefer after «Референс» or before it so compliance is visible early; concrete placement: after «Структура», before «Команды».
- **Rationale:** Stable English heading for acceptance snapshots; body in Russian like the rest of README.
- **Alternatives:** Fully English section — rejected (breaks README language consistency).

### 3. CONFORMANCE cross-links without hand-edit

- **Choice:** Primary cross-links live in README + VitePress page. Optional: add a single generator-owned “See also” / related-docs line only if it fits existing markdown builder without touching requirement rows (e.g. static footer after Waivers, driven by a constant in `scripts/gen-conformance-statement.mjs`, then regenerate). Default apply path: **skip generator change** unless a one-line footer is trivial and `conformance:check` stays green.
- **Rationale:** Criteria forbid hand-editing coverage tables; README+docs already satisfy discoverability.
- **Alternatives:** Hand-patch `CONFORMANCE.md` Limitations — rejected (breaks drift gate).

### 4. Knowledge sync scope

- **Choice:** Update `parity-gap-roadmap.md`, `bapm-apm-parity-report.md`, `bapm-openapm-conformance.md` (and criteria topic status if needed) under `.samples/apm-knowledge/`. Mark S5/P5 done after apply; next = closed for OpenAPM floor track / multi-target separate.
- **Rationale:** Criteria DoD item 4; knowledge is local/gitignored but orch apply still edits it for operators.
- **Note:** Knowledge files are outside OpenSpec self-commit allowlist for plan; they land in apply.

### 5. Acceptance shape

- **Choice:** Lightweight tests reading files for heading/link/phrase presence (README section, VitePress page + sidebar entry, landing/architecture no longer advertising multi-client as shipped). No product/CLI tests.
- **Rationale:** Docs-only DoD; RED→GREEN on artifacts only.

### 6. Package READMEs

- **Choice:** No mandatory package README one-liners.
- **Rationale:** Criteria open question — root + docs suffice for P5 scope control.

## Risks / Trade-offs

- **Overclaim** → Mitigation: explicit “not drop-in APM CLI” + out-of-scope list mirrored from CONFORMANCE Limitations.
- **Stale VitePress landing** → Mitigation: task checklist includes landing + guide intro + architecture, not only the new page.
- **CONFORMANCE hand-edit drift** → Mitigation: never edit coverage tables; regenerate if generator touched; run `conformance:check`.
- **Knowledge lag** → Mitigation: explicit apply tasks for the three knowledge topics.

## Migration Plan

1. Acceptance suite (docs presence) goes RED.
2. Apply README section, VitePress page + nav, marketing fixes, optional generator footer, knowledge sync.
3. Confirm `conformance:check` green if generator touched.
4. Accept → promote → merge; archive change when orch completes.

## Open Questions

_None deferrable — VitePress page vs subsection and package README one-liners decided above._
