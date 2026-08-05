## Why

Governance is already claimed and enforced on install/lock, but bapm has no standalone diagnostic CLI for policy posture. Operators cannot inspect discovery source, enforcement, extends, or rule counts without running a mutating flow. APM exposes `apm policy status` for exactly this; P6d adds a thin equivalent — observability only, no new engine and no CONFORMANCE reopen.

## What Changes

- Add CLI group `bapm policy` with subcommand `status` only (no `explain`, no approve/deny)
- Add core read-only status helper over existing Policy discovery/resolve APIs (same path as gate)
- Support `--json`, `--policy <path>`, `--no-policy` / `BAPM_POLICY_DISABLE` / `APM_POLICY_DISABLE`, and `--check`
- Human + JSON report: outcome, source, provider, enforcement, extends_chain, rule_counts, warnings, diagnostics
- Redact credential-bearing URLs; ASCII-safe deterministic output in tests
- Surface dual-local conflict and soft fetch/schema failures as diagnostic outcomes without mutation
- Default exit `0`; `--check` exits non-zero when no usable policy is found
- Update top-level help to mention `policy`
- Omit `--no-cache` and APM-only cache fields (no truthful bapm cache model)

## Capabilities

### New Capabilities

- `policy-status`: Read-only diagnostic report for current effective policy posture

### Modified Capabilities

- `cli-runtime-surface`: Register `policy` command group / `status` subcommand and help
- `policy-install-gate`: No behavior change to gate; status must reuse the same discovery/resolve path (observability requirement only — no delta behavioral change)

## Impact

- `packages/core` Policy module: status report builder + public export
- `packages/cli`: new Policy module + command/app wiring + help
- Tests for found/absent/escaped/explicit path/dual-conflict/fetch failure/JSON/redaction/read-only
- Knowledge/roadmap note; **no** CONFORMANCE claim edits; no new providers or policy families
