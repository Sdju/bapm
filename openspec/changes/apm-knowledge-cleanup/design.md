## Context

`.samples/` is gitignored (`.gitignore` → `.samples/`). Knowledge lives only on developer/CI workspaces that clone APM samples; OpenSpec change artifacts live in-repo. See proposal.md for motivation. Current INDEX (~42 lines) and topics still index eighteen archived criteria/triage files; deep-dives mix APM facts with orch status.

## Goals / Non-Goals

**Goals:**

- Restore apm-expert corpus to APM expertise: Facts + Source map (+ OpenAPM posture where needed).
- Salvage approve/deny APM source map before deleting `sc-executable-governance-criteria.md`.
- Make acceptance assert the corpus contract when files exist; soft-skip when `.samples/apm-knowledge/` is absent.
- Commit only OpenSpec (and later acceptance) under git; knowledge edits stay local.

**Non-Goals:**

- Editing `.samples/apm`, bapm production code, CONFORMANCE claims, or other OpenSpec changes/archives.
- Rewriting keep-list files.
- Perfect line-count polish beyond budgets (±0 preferred; soft upper bound in spec).

## Decisions

### D1: Capability = corpus contract, not product behavior

- **Choice:** New delta `apm-knowledge-corpus` with path/budget/posture requirements.
- **Why:** Acceptance needs a testable contract; inventing CLI requirements would be wrong.
- **Alt:** `skip_specs: true` — rejected because acceptance must still encode delete/keep/condense.

### D2: Salvage-first ordering

1. Create `command-deep-dive-approve.md` from the APM reference table in `sc-executable-governance-criteria.md` (§ APM reference approve/deny/trust — ≤30 lines: surface table + key paths).
2. Condense retained topics + rewrite INDEX.
3. Delete the eighteen files.
4. Verify keep-list untouched (except INDEX links).

### D3: Condense strategy

- Prefer rewrite over surgical delete: drop orch sections (MUST tables, Feasibility, Product defaults, Validation, archived change SHAs).
- Keep: APM behavior bullets, source path tables, OpenAPM class/DEFER lists, marketplace surface notes.
- Budgets from audit (INDEX ~30; conformance ~40–50; parity ~30; roadmap ~20; deep-dives ~30–45; research ~60–70; sc-implement-then-claim ~25).

### D4: Git vs workspace split

| Artifact | Tracked? |
|----------|----------|
| `openspec/changes/apm-knowledge-cleanup/**` | yes |
| Acceptance under `tests/acceptance/apm-knowledge-cleanup/` (later phase) | yes |
| `.samples/apm-knowledge/**` | no (gitignore) |

Apply edits knowledge on disk when present; commit only OpenSpec (plan) / acceptance (RED) / none for knowledge.

### D5: Acceptance pattern

- `existsSync('.samples/apm-knowledge')` → if false, `describe.skip` or early return pass.
- If true: `fs.existsSync` / `!exists` for delete/keep/approve; `readFile` line counts; INDEX must not mention deleted basenames; approve file must mention approve/deny + resolver paths.

## Risks / Trade-offs

- **[Risk] Delete before salvage** → Mitigation: D2 order; tasks list salvage as first apply step.
- **[Risk] CI without `.samples/` never catches regressions** → Mitigation: soft-skip documented; local/orch runs with knowledge present enforce; OpenSpec still records the contract.
- **[Risk] Over-condense loses useful APM paths** → Mitigation: posture requirement “Facts + Source map”; keep-list untouched.
- **[Trade-off] Knowledge not in git** → Reviewers see OpenSpec + acceptance; apply agent must touch local tree.

## Migration Plan

1. Propose (this change) → acceptance RED against corpus contract → apply GREEN on local knowledge → accept → promote → merge archives delta into `openspec/specs/apm-knowledge-corpus/`.
2. Rollback: restore deleted topics from backup/local history if needed; OpenSpec revert is independent.
3. No production deploy.

## Open Questions

None — audit lists and budgets are authoritative for this change.
