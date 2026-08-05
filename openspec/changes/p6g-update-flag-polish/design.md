## Context

See proposal.md — Why. Baseline:

- CLI `packages/cli/.../Update/services/runUpdate.ts`: parses `-y`, `--dry-run`, policy flags, packages; unknown flags fail-closed; **no** `-v` / `--parallel-downloads`.
- Core `packages/core/.../Update`: `parallelDownloads` already passed to `resolveAndLock`; `formatPlan` always emits `[=] … keep` for every keep row; no `verbose` option.
- Precedent: install CLI already parses `-v` / `--parallel-downloads` with the same int/`0`=serial rules — copy that parsing pattern for update.

Criteria: `.samples/apm-knowledge/topics/p6g-update-flag-polish-criteria.md` (chosen APM hide-keep-unless-verbose).

## Goals / Non-Goals

**Goals:**

- Thin CLI parity for `-v` and `--parallel-downloads` on `update`.
- Core plan text gating on `verbose` so dry-run / confirm previews match APM quieter default.
- Default concurrency 4 when the flag is omitted; `0` serial end-to-end.

**Non-Goals:**

- APM `--force` security overwrite (core `force` stays frozen-override only — do not expose as APM force).
- Richer verbose pipeline progress beyond keep rows (SHOULD, optional later).
- Thickening dry-run resolve quality.
- `--global`, multi-target, deps info/view, CONFORMANCE claim edits.

## Decisions

### 1. Mirror install flag parsing in `parseUpdateArgs`

**Choice:** Copy install’s `-v`/`--verbose` and `--parallel-downloads` / `=` forms (finite `n >= 0`, `Math.floor`). Invalid through to `coreRunUpdate({ verbose, parallelDownloads })`.

**Alternatives:** Shared argv helper — deferred; two call sites are small and install is the proven template.

### 2. Gate keep rows in core `formatPlan`, not only CLI

**Choice:** Add `verbose?: boolean` to `RunUpdateOptions`; `formatPlan(plan, { verbose })` filters `action === "keep"` when `!verbose`. After filter, if no lines remain, emit the existing empty-plan message (`No dependency changes planned` or equivalent). Keep full `plan` array on `UpdateResult` for tests/callers.

**Rationale:** Dry-run and post-apply text both go through `formatPlan`; gating once avoids CLI/core drift. APM gates at plan render, not by dropping computed keeps.

**Alternatives:** CLI-only filter of `result.text` — rejected (core API users would still always-print keeps).

### 3. Default `parallelDownloads = 4` when omitted

**Choice:** When CLI omits the flag, pass `undefined` or explicit `4` such that resolve sees **4**. Prefer aligning with install: if install relies on core default, update SHOULD use the same default site (document in apply). Explicit `0` must reach core as `0`.

**Alternatives:** Leave undefined forever if resolve already defaults to 4 — acceptable if verified; otherwise set `4` at CLI or update entry.

### 4. No `--force` exposure

**Choice:** Do not add CLI `--force`. Core `force` remains frozen override only; criteria forbid APM-force naming/semantics in this change.

## Risks / Trade-offs

- **[Risk]** Tests that assert keep lines in default dry-run output break → **Mitigation:** update those assertions to use `-v` or expect quiet plan; acceptance suite owns the new contract.
- **[Risk]** Empty printed plan after hide-keeps looks like a bug → **Mitigation:** reuse honest empty-change string; acceptance covers all-keep fixture.
- **[Risk]** Accidental claim of APM `--force` parity in help → **Mitigation:** MUST NOT document `--force` in this change (optional SHOULD note “intentionally absent” only if cheap and non-confusing).

## Migration Plan

- Pure additive CLI flags + quieter default plan text (behavior change for keep visibility).
- No lock/manifest format migration; no CONFORMANCE table edits.
- Rollback: revert change; no data migration.

## Open Questions

- None blocking apply (criteria resolved hide-keep-unless-verbose).
