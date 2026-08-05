## Why

After P6e (algorithm + `-v`) and p7a, `outdated` still lacks APM `--parallel-checks` / `-j` (default 4, `0` = serial, order-preserving). Large lockfiles stay slow under sequential remote checks, and operators have no truthful machine-readable row dump for scripting. This slice closes that UX gap without reopening the tip/`constraint` algorithm, CONFORMANCE, or APM-only invented fields.

## What Changes

- CLI accepts `-j <n>` / `--parallel-checks <n>` (and `=n` forms consistent with install/update parallel flags); default **4** when omitted; **`0` = sequential**; invalid/missing value → non-zero fail-closed.
- Core `runOutdated` gains `parallelChecks` and a bounded concurrent pool for remote checks; **row order matches lock dependency order**; when `n > 0` and multiple checkable deps, concurrency is actually bounded (no no-op flag).
- Keep P6e semantics unchanged: tip of `resolved_ref`, constraint path, no invented `^`, exit 0 with outdated rows, no lock → ≠0, read-only.
- Help documents `-j` / `--parallel-checks` (default 4 / `0` serial); unknown flags remain fail-closed; **`-j` never means JSON**.
- **SHOULD (in scope — thin):** `--json` emits stable JSON of existing core `OutdatedRow` values on stdout; suppress human table/text; errors on stderr (same posture as `deps why --json` / `policy status --json`). Not APM CLI parity (APM has no `outdated --json`); do not invent `source` / marketplace / registry keys.
- Unit/CLI tests: parse/help; `0` serial; `n>0` pool-bounded with stubs; lock order; P6e regressions green; JSON shape locked by tests. Prefer `parallelChecks: 0` / stubs in unit tests for determinism.

**Non-goals:** `--global` / `-g`; marketplace/registry outdated; full-SHA → annotated-tag (**p7g**); CONFORMANCE claim-table / OpenAPM class churn; claiming APM has `outdated --json`; inventing APM-only JSON fields; changing P6e tip/constraint/exit/read-only algorithm.

## Capabilities

### New Capabilities

- _(none)_ — behaviour extends existing outdated / CLI surfaces.

### Modified Capabilities

- `lifecycle-outdated`: bounded concurrent remote checks via `parallelChecks` (default 4, `0` serial); preserve lock order; no change to tip/`constraint`/exit/read-only contracts.
- `cli-runtime-surface`: parse/help/wire `-j` / `--parallel-checks` and `--json`; fail-closed on invalid parallel values; document truthful flags (no APM `--json` claim).

## Impact

- `@bapm/core` Outdated: `RunOutdatedOptions.parallelChecks`, concurrent map with order restore (reuse pool pattern akin to Resolver download).
- `bapm` CLI Outdated: `parseOutdatedArgs` / help / stdout JSON vs human text.
- Tests: CLI parse/help + core concurrency/order stubs; existing P6e outdated suites remain green.
- No CONFORMANCE.md edits; no `--global`; algorithm files stay semantics-stable aside from concurrency wiring.
