## Context

See `proposal.md` for motivation. Today `@bapm/core` Install calls `resolveAndLock` / `downloadPackages` before primitives and target materialize; there is no Policy module. Dual-read for manifest/lock already exists (`Manifest/discover.ts`, Lockfile twin). Normative acceptance: `.samples/apm-knowledge/topics/m8-governance-acceptance.md`. FEOD: library profile for core (`modules/Policy/`), locked CLI profile for thin command wiring. Packages: `@bapm/core` + CLI only; cursor untouched except incidental install option plumbing.

## Goals / Non-Goals

**Goals:**

- Ship parse + local dual-read discovery + rule evaluate + install gate (plan → gate → download preferred)
- Modes `off|warn|block`; escape `--no-policy` / `BAPM_POLICY_DISABLE`
- Gate `lock` when cheap; same gate on mutating `update`
- Document local-only provider list; optional thin `policy status`

**Non-Goals (design-level):**

- Remote `github-owner-dotgithub`, `extends` merge chain, pl-010 fetch_failure remote path
- `approve`/`deny` exec grants (M9)
- New `bapm-target-*`; deep MCP/compile policy (M9)
- Full OpenAPM Governance class claim unless subset listed later

## Decisions

### D1: Core module `Policy` owns parse/discover/evaluate/gate

- **Choice:** `packages/core/src/modules/Policy/` with public `index.ts`; Install/Lock/Update call gate helpers via `@/modules/Policy`.
- **Why:** Mirrors Manifest/Lockfile FEOD; keeps CLI thin.
- **Alternatives:** logic inside Install only — rejected (reuse by lock/update/status harder).

### D2: Local-only discovery providers for M8

- **Choice:** Ordered providers = `[local-dual-read]`; document remote as deferred N/A (resolves open question in acceptance).
- **Why:** User default; satisfies pl-011 posture without inventing GitHub Contents fetch.
- **Alternatives:** ship thin github-owner provider — deferred.

### D3: Plan → gate → download for pl-002

- **Choice:** Split resolve graph/plan from `downloadPackages` on gated paths; run gate on planned nodes/deps before download and before target deploy. Refactor `resolveAndLock` or Install to call `resolveDependencyGraph` → gate → download → lock write as needed.
- **Why:** APM may download during resolve; OpenAPM pl-002 prefers no durable bytes before abort.
- **Alternatives:** gate after `resolveAndLock` (may already have modules) — only if refactor cost extreme; document residual gap.

### D4: Dual-read mirrors Manifest discover

- **Choice:** Same existence matrix as M1 (only-apm / only-bapm / both-error / neither-absent); explicit path wins; no parent walk; constants `APM_POLICY_FILE` / `BAPM_POLICY_FILE`.
- **Why:** Consistency with product dual-read; acceptance section B.

### D5: Lock gate SHOULD — include by default

- **Choice:** Wire the same gate into lock path (user: include if cheap). Reuse core gate; CLI gains `--policy` / `--no-policy` on lock.
- **Why:** APM parity; cheap once Install split exists.
- **Alternatives:** document-only defer — fallback if resolve/download split slips.

### D6: Escape env names

- **Choice:** Primary `BAPM_POLICY_DISABLE=1`; also honor `APM_POLICY_DISABLE=1` for drop-in muscle memory.
- **Why:** Acceptance asks BAPM mirror of APM.

### D7: Optional `bapm policy status`

- **Choice:** Thin CLI command if cheap after core discover API; otherwise install diagnostics only.
- **Why:** Useful for conformance docs; not on MUST bar.

### D8: Deferred pl-*

- **Choice:** `extends` (pl-003/006), host-class pin (pl-004), remote (pl-012), fetch_failure block on remote (pl-010), pl-013/014/015/016 — N/A or later SHOULD; single-doc local policy only in M8.
- **Why:** Keep M8 install-centric MUST bar small.

## Risks / Trade-offs

- [Resolve downloads before gate today] → Mitigate by splitting plan/download on gated paths; acceptance tests assert no new modules on block.
- [Identity matching for allow/deny patterns] → Start with APM-like glob/prefix rules sufficient for `org/*` fixtures; document exact matcher.
- [Lock without gate if split delayed] → Explicit doc in tasks/conformance; prefer shipping gate.
- [Governance claim overreach] → Claim optional; list implemented pl-* and local-only providers.

## Migration Plan

1. Add Policy module + unit tests (parse/discover/evaluate) without changing install behavior.
2. Wire gate into Install (plan→gate→download); then lock/update.
3. CLI flags + help; optional policy status.
4. Regression: M3–M7 paths without policy remain green.
5. No data migration; users add `bapm-policy.yml` opt-in. Rollback = disable env / remove policy file / `--no-policy`.

## Open Questions

- Exact allow/deny pattern grammar beyond fixtures in acceptance (follow APM `policy_checks` when implementing).
- Whether `policy status` ships in the same apply pass or immediately after MUST bar — leave to implementer if schedule tight.
