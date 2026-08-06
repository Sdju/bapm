## Purpose

Defines the local apm-expert knowledge corpus under `.samples/apm-knowledge/`: durable APM expertise topics only, without orch PM criteria logs, with explicit delete/keep/condense contracts and salvage of approve/deny source maps.

## ADDED Requirements

### Requirement: Orch criteria and triage topics are removed

When the knowledge tree is present at `.samples/apm-knowledge/`, the following topic files MUST NOT exist:

- `topics/parity-gap-round-2026-08-06.md`
- `topics/parity-defer-triage-2026-08-06.md`
- `topics/p7a-install-project-flags-criteria.md`
- `topics/p7b-outdated-machine-output-criteria.md`
- `topics/p7c-deps-why-basename-criteria.md`
- `topics/p7d-compile-cursor-polish-criteria.md`
- `topics/p7e-lock-fail-closed-flags-criteria.md`
- `topics/p7f-doctor-verbose-criteria.md`
- `topics/p7g-outdated-sha-tag-drift-criteria.md`
- `topics/mp-consumer-registry-criteria.md`
- `topics/mp-search-install-criteria.md`
- `topics/mp-find-criteria.md`
- `topics/mp-plugin-init-criteria.md`
- `topics/mp-authoring-yml-criteria.md`
- `topics/mp-pack-outputs-criteria.md`
- `topics/mp-sc-claims-criteria.md`
- `topics/mp-hosts-auth-criteria.md`
- `topics/sc-executable-governance-criteria.md`

INDEX MUST NOT list those basenames as live topics.

#### Scenario: Deleted criteria paths are absent

- **WHEN** the workspace contains `.samples/apm-knowledge/topics/`
- **THEN** none of the eighteen deleted filenames above MUST exist on disk

#### Scenario: INDEX does not index deleted topics

- **WHEN** a reader opens `.samples/apm-knowledge/INDEX.md`
- **THEN** INDEX MUST NOT contain links or table rows for those deleted basenames

### Requirement: Approve deep-dive preserves APM source map

Before or as part of removing `sc-executable-governance-criteria.md`, the corpus MUST add `topics/command-deep-dive-approve.md` of at most 30 lines that documents APM `approve`/`deny` CLI behavior and the deny-wins resolver source map (at minimum paths to APM `approve.py` and `security/executables.py` `resolve_exec_decision`, or equivalent accurate APM paths). The topic MUST be APM expertise, not an orch criteria checklist.

#### Scenario: Approve topic exists within budget

- **WHEN** the knowledge tree is present after cleanup
- **THEN** `topics/command-deep-dive-approve.md` MUST exist and MUST contain at most 30 lines

#### Scenario: Approve topic cites APM approve and resolver sources

- **WHEN** a reader opens `topics/command-deep-dive-approve.md`
- **THEN** the text MUST mention `approve`/`deny` and MUST cite APM source paths for the approve command and executable decision resolver

### Requirement: Keep-list topics remain present

The following paths MUST remain present and MUST NOT be deleted by this cleanup:

- `README.md`
- `topics/overview.md`
- `topics/openapm-spec.md`
- `topics/cli-commands.md`
- `topics/bapm-target-packages.md`
- `topics/command-deep-dive-marketplace-authoring.md`
- `topics/sc-host-class-criteria.md`

#### Scenario: Keep-list files still exist

- **WHEN** the knowledge tree is present after cleanup
- **THEN** each keep-list path above MUST exist

### Requirement: INDEX is a short topic index

`INDEX.md` MUST be at most ~30 lines and MUST consist of a topic index plus at most a one-line APM summary (no orch PM status parade of archived change names as the primary content).

#### Scenario: INDEX within budget and indexed

- **WHEN** a reader opens `.samples/apm-knowledge/INDEX.md` after cleanup
- **THEN** the file MUST have at most 30 lines and MUST list retained topics including the approve deep-dive and keep-list expertise topics

### Requirement: Condensed expertise topics meet budgets and posture

When present, the following files MUST meet these approximate line budgets and MUST retain APM Facts / Source map (or OpenAPM posture) rather than orch PM logs:

| File | Max lines (approx) | Content posture |
|------|--------------------|-----------------|
| `topics/bapm-openapm-conformance.md` | 50 | classes, intentional diffs, APM source map |
| `topics/bapm-apm-parity-report.md` | 30 | DEFER/N/A vs APM register |
| `topics/parity-gap-roadmap.md` | 20 | closed tracks + remaining DEFER + pointer to `sc-host-class-criteria` |
| `topics/command-deep-dive-install.md` | 45 | APM Facts + Source map |
| `topics/command-deep-dive-policy.md` | 45 | APM Facts + Source map |
| `topics/command-deep-dive-outdated.md` | 45 | APM Facts + Source map |
| `topics/command-deep-dive-deps.md` | 45 | APM Facts + Source map |
| `topics/command-deep-dive-update.md` | 45 | APM Facts + Source map |
| `topics/command-deep-dive-compile.md` | 45 | APM Facts + Source map |
| `topics/research-marketplace-plugin-search-find.md` | 70 | APM marketplace surface/models/auth/OpenAPM posture |
| `topics/sc-implement-then-claim-criteria.md` | 25 | skipped inventory + next claim |

#### Scenario: Conformance and parity topics within budget

- **WHEN** those condensed topic files exist after cleanup
- **THEN** each MUST be within its max line budget above

#### Scenario: Deep-dives are Facts plus Source map

- **WHEN** a reader opens any of the six command-deep-dive-{install,policy,outdated,deps,update,compile}.md files after cleanup
- **THEN** the file MUST emphasize APM facts and source paths and MUST NOT be primarily an orch archived-change status log

### Requirement: Cleanup does not touch forbidden trees

This change MUST NOT modify `.samples/apm`, production packages under `packages/` or `apps/`, or OpenSpec archives of other changes. Git-tracked deliverables for the change itself are OpenSpec planning artifacts (and later acceptance asserting the corpus contract when knowledge files are available).

#### Scenario: Forbidden paths unchanged by apply

- **WHEN** apply completes the knowledge cleanup
- **THEN** no edits MUST be required under `.samples/apm`, `packages/`, or `apps/` for this change

### Requirement: Acceptance may skip when knowledge tree is absent

Acceptance tests for this capability MUST pass when `.samples/apm-knowledge/` is absent (gitignored / not cloned) by skipping corpus path assertions, and MUST enforce the delete/keep/condense/approve requirements when the tree is present.

#### Scenario: Missing knowledge tree is soft-skip

- **WHEN** acceptance runs in an environment without `.samples/apm-knowledge/`
- **THEN** corpus path assertions MUST skip without failing the suite

#### Scenario: Present knowledge tree is fully asserted

- **WHEN** acceptance runs and `.samples/apm-knowledge/` exists
- **THEN** delete absence, keep presence, approve topic, INDEX, and condense budgets MUST be asserted
