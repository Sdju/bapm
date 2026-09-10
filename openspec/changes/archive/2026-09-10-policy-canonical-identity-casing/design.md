## Context

See `proposal.md` — Why. Today `packages/core/src/modules/Policy/match.ts` compares identities to allow/deny/require patterns with byte-exact equality / glob regex (no ASCII fold). Lockfile `normalizePackageRepoUrl` already lowercases `github.com` and registry paths; Resolver `normalizeRepoIdentity` lowercases **host** only and preserves path case — so Consumer identity layers already disagree, and policy matching is a third, fail-open posture for mixed-case deny. OpenAPM floor in checklist / CONFORMANCE stops at req-pl-016; APM discloses a dedicated Repository case rules paragraph (req-rs-016 clause 3 + req-pl-018).

## Goals / Non-Goals

**Goals:**

- Single shared case rule for policy match and package identity (GitHub / `.ghe.com` / `GITHUB_HOST` / registry).
- Fail-closed deny + working mixed-case allow/require; lowercase patterns remain matching.
- Honest CONFORMANCE disclosure + req-pl-018 active claim; req-pl-017 n/a (ADO).

**Non-Goals:**

- Redesigning glob grammar beyond ASCII case treatment; MCP / unmanaged path folding; ADO pl-017 implementation; distribution (gh-aw) surfaces.

## Decisions

### D1: Shared ASCII fold helper, match-time for policy

- **Choice:** Introduce a small shared helper (Policy and/or Lockfile/Resolver) that, given subject + pattern + `{ host?, source? }`, ASCII-lowercases only the first N repository-coordinate segments (and truncates before `**` for globs). Wire it into `identityMatchesPattern` / evaluate; keep merge (`Policy/merge.ts`) byte-exact.
- **Why:** req-pl-018 normalizes at match time only; Section 6.4 explicitly keeps authored case variants distinct during merge.
- **Alternatives:** Lowercase all candidate ids once at evaluate entry — rejected (breaks virtual-path sensitivity and case-sensitive hosts). Fold during merge — rejected (spec forbids).

### D2: Disclosed case-insensitive host set

- **Choice:** Match APM CONFORMANCE: `github.com`, `*.ghe.com`, literal `GITHUB_HOST` value when set, plus always-fold for `source === "registry"` (and registry-prefix). Default host when shorthand `owner/repo` is used: implementation-default `github.com`.
- **Why:** Same rule as req-rs-016 clause 3 + APM published statement; avoids inventing a bapm-only fold set.
- **Alternatives:** Fold every host — rejected (OpenAPM default is case-sensitive; gitlab.com tests require byte-exact). Fold only github.com — incomplete vs APM / GHE.

### D3: Align Resolver identity with Lockfile

- **Choice:** Update Resolver path normalization to apply the same host/source fold as Lockfile (and policy), so cache keys and policy subjects cannot diverge. Preserve display/`materialization_repo_url` spelling separately where already modeled.
- **Why:** Spec: “repository identity and policy matching MUST NOT diverge.”
- **Alternatives:** Leave Resolver path-preserving and only fold in policy — rejected (creates two identities for one GitHub package).

### D4: Evaluate context for host/source

- **Choice:** Extend candidate / evaluate inputs to carry optional `host` and `source` (registry vs git). When absent, infer from identity shape (FQDN prefix → host; bare `owner/repo` → github.com; `source: registry` when tagged).
- **Why:** Registry rule must win over host rule; gitlab.com must stay sensitive.
- **Alternatives:** Always assume github.com — wrong for non-default hosts.

### D5: Conformance generator case-rules section

- **Choice:** Add optional `repository_case_rules` (or reuse a structured checklist field) and emit a `## Repository case rules` section in `gen-conformance-statement.mjs`, mirroring APM. Add checklist rows for req-pl-018 (active) and req-pl-017 (n/a, ADO rationale). Update informative `openapm-v0.1.requirements.yml`.
- **Why:** OpenAPM §11.2 item 6 requires the per-host case rule in the conformance statement when claiming Governance / case-insensitive hosts.
- **Alternatives:** Only a limitations bullet — weaker than APM and easy to miss in Mode B review.

### D6: Require matching

- **Choice:** Exact require uses the same fold on the package portion before `#`; `*` in require stays literal (no glob). Do not change require version/`#ref` comparison beyond existing behavior in this slice unless already covered by evaluate.
- **Why:** req-pl-018 clause (a); APM tests assert `DevExpGbb/*` does not glob-match.

## Risks / Trade-offs

- [Broader allow/deny hits after fold] → Mitigation: document as OpenAPM non-breaking correction; lowercase workarounds keep working; advise re-audit of mixed-case policy entries.
- [Resolver identity key churn for mixed-case GitHub locks] → Mitigation: same as Lockfile already lowercases github paths; warm replay / materialization_repo_url retain display spelling.
- [Incomplete host inference in unit tests] → Mitigation: acceptance fixtures pass explicit `source`/`host`; unit tests cover gitlab vs github vs registry matrices from APM `test_policy_reqs.py`.
- [Generator churn for CONFORMANCE] → Mitigation: single checklist + gen run; `conformance:check` in CI.

## Migration Plan

- No lockfile format bump.
- Operators: lowercase deny/allow patterns remain valid; drop duplicate case-variant workarounds only after all runners use the folded matcher.
- Rollback: revert matcher + identity fold + checklist rows (unlikely once claimed).

## Open Questions

None — host set, match-time-only fold, and pl-017 n/a locked to OpenAPM / APM CONFORMANCE + parent criteria.
