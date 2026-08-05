## Context

See proposal. Governance gate already exists in `@bapm/core` Policy (`discoverPolicyWithProviders`, `loadPolicy`, `resolvePolicyChain`, `runPolicyGate`). CLI has no `policy` command. APM reference: `apm policy status` with always-exit-0 default and structured JSON. Criteria: `.samples/apm-knowledge/topics/p6d-policy-status-criteria.md`; deep-dive: `command-deep-dive-policy.md`.

## Goals / Non-Goals

**Goals:**
- Thin CLI `policy status` + core report helper
- Same discovery/resolve path as gate (no second resolver)
- Human + JSON output; `--check` exit flip for CI
- Redaction; read-only; ASCII-safe deterministic tests
- Explicit dual-conflict / fetch-failure diagnostic outcomes

**Non-Goals:**
- `policy explain`, approve/deny / executable-trust UX
- New providers / ADO cascade / APM multi-candidate remote chain
- Cache TTL / freshness / hash-pin fiction if not already in bapm
- CONFORMANCE claim edits; new policy families beyond current evaluate set
- Optional file report output

## Decisions

1. **Core API:** Add `runPolicyStatus(options) -> PolicyStatusReport` in Policy module (not a separate domain module). Reuses discovery/load/resolve; does not call evaluate against install candidates unless needed for diagnostics. CLI formats only.
2. **Outcome enum:** `found` | `absent` | `disabled` | `error` (covers dual-conflict / fetch/schema failures that gate would surface). Default status never throws to CLI as uncaught for these — maps to report + exit 0 unless `--check`.
3. **`--check`:** Included in P6d (APM parity for CI gating of “policy present”). Non-zero when outcome is not usable `found`.
4. **Provider field:** Explicit `provider` string (`local` | `github-owner-dotgithub` | `explicit` | `none` | `escaped`).
5. **Rule counts:** Derived from effective `PolicyDocument.dependencies` only (families bapm evaluates: allow/deny/require/max_depth/require_pinned_constraint).
6. **Escape:** `--no-policy` and env `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1` → `disabled` (reuse `isPolicyDisabled`).
7. **Local files:** Same dual-read as gate (`apm-policy.yml` / `bapm-policy.yml`); both present → conflict → `error` diagnostic, no mutation.
8. **CLI FEOD:** New `modules/Policy` + `commands/policy.ts` + `app/init/policy.ts`; register `policy` in registry/constants/help.
9. **No `--no-cache`:** bapm has no status-influencing cache model to expose truthfully.
10. **Output:** Human compact fields + `--json` stable keys; redact credentials; ASCII-safe / deterministic in tests. Omit APM-only cache_age_* fields.

## Risks / Trade-offs

- [Fake APM cache fields] → Mitigation: omit cache age
- [Duplicate resolve logic in CLI] → Mitigation: all logic in core helper
- [Gate throws on dual-conflict] → Mitigation: status catches PolicyError and maps to `outcome: error` with diagnostics; still exit 0 without `--check`
- [Over-scope into explain/approve] → Mitigation: hard non-goals; only `status` subcommand
- [Confusing absent vs disabled vs error] → Mitigation: explicit outcome enum + diagnostics

## Migration Plan

Ship behind normal release; no data migration. Help text gains `policy`. No CONFORMANCE class changes.

## Open Questions

None blocking — criteria open questions resolved: `--check` in P6d; explicit `provider`; core `runPolicyStatus` returns normalized counts.
