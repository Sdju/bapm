## Why

Local `.samples/apm-knowledge/` has become an orch PM log: archived change criteria, dated triage notes, and long deep-dives mixed with APM expertise. `apm-expert` needs a slim corpus of APM facts and source maps, not closed-change checklists. Cleanup restores that posture after the p7/mp/sc floor landed.

## What Changes

- **DELETE** 18 orch/criteria/triage topics (p7*, mp-*-criteria, parity-gap-round/defer-triage, sc-executable-governance-criteria) after extracting APM approve/deny source map into a new durable topic.
- **ADD** `topics/command-deep-dive-approve.md` (≤30 lines): APM `approve`/`deny` + `resolve_exec_decision` source map salvaged from `sc-executable-governance-criteria.md`.
- **CONDENSE** INDEX and retained expertise topics to stated line budgets; strip orch status / archived-change chatter; keep APM Facts + Source map (and OpenAPM posture where relevant).
- **KEEP as-is** README, overview, openapm-spec, cli-commands, bapm-target-packages, command-deep-dive-marketplace-authoring, sc-host-class-criteria.
- **Non-goals:** no bapm production code, no `.samples/apm`, no openspec archive of other changes, no new CLI/features.

## Capabilities

### New Capabilities

- `apm-knowledge-corpus`: Contract for the local apm-expert knowledge tree under `.samples/apm-knowledge/`: which paths must be absent, which must exist (including the new approve deep-dive), keep-list invariants, condense budgets, and APM-expertise-only content posture (not orch PM log).

### Modified Capabilities

- (none) — no product/OpenAPM claim or CLI requirement changes; this is knowledge hygiene only.

## Impact

- **In (workspace, often gitignored):** `.samples/apm-knowledge/INDEX.md`, `.samples/apm-knowledge/topics/*` per DELETE/CONDENSE/KEEP/ADD lists.
- **In (git):** OpenSpec change artifacts under `openspec/changes/apm-knowledge-cleanup/`; acceptance may assert path presence/absence and INDEX structure when knowledge files exist in the workspace.
- **Out:** `packages/**`, `apps/**`, `.samples/apm`, other OpenSpec changes/archives, CONFORMANCE claim tables.
- **Risk:** Losing APM approve/deny map if delete runs before salvage; over-condensing away useful source paths — design mandates salvage-first and Facts+Source-map retention.
