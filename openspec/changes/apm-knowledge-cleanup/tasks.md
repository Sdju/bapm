## 1. Salvage approve expertise

- [ ] 1.1 Create `.samples/apm-knowledge/topics/command-deep-dive-approve.md` (≤30 lines) from APM approve/deny + `resolve_exec_decision` source map in `sc-executable-governance-criteria.md`
- [ ] 1.2 Verify approve topic cites APM `approve.py` and `security/executables.py` (or equivalent) and is not an orch criteria checklist

## 2. Condense retained topics

- [ ] 2.1 Rewrite `INDEX.md` to ≤30 lines: topic index + one-line APM summary; drop deleted basenames; include approve deep-dive and keep-list
- [ ] 2.2 Condense `bapm-openapm-conformance.md` to ~40–50 lines (classes, intentional diffs, APM source map)
- [ ] 2.3 Condense `bapm-apm-parity-report.md` to ~30 lines (DEFER/N/A vs APM register)
- [ ] 2.4 Condense `parity-gap-roadmap.md` to ~20 lines (closed + remaining DEFER + `sc-host-class-criteria` pointer)
- [ ] 2.5 Condense each `command-deep-dive-{install,policy,outdated,deps,update,compile}.md` to ~30–45 lines (APM Facts + Source map only)
- [ ] 2.6 Condense `research-marketplace-plugin-search-find.md` to ~60–70 lines (APM marketplace surface/models/auth/OpenAPM posture)
- [ ] 2.7 Condense `sc-implement-then-claim-criteria.md` to ~25 lines (skipped inventory + next claim)

## 3. Delete orch criteria / triage

- [ ] 3.1 Delete the eighteen listed criteria/triage topic files (including `sc-executable-governance-criteria.md` after 1.x)
- [ ] 3.2 Confirm keep-list files unchanged: README, overview, openapm-spec, cli-commands, bapm-target-packages, command-deep-dive-marketplace-authoring, sc-host-class-criteria
- [ ] 3.3 Confirm no edits under `.samples/apm`, `packages/`, or `apps/`

## 4. Verify corpus contract

- [ ] 4.1 Assert deleted paths absent and approve + keep-list present (`test -e` / `! test -e`)
- [ ] 4.2 Assert line budgets with `wc -l` for INDEX and condensed topics
- [ ] 4.3 Spot-check INDEX has no links to deleted basenames
