## 1. Core parallelChecks

- [x] 1.1 Add `parallelChecks?: number` to `RunOutdatedOptions`; default unresolved/`undefined` to **4** inside `runOutdated` (`0` = serial)
- [x] 1.2 Refactor per-dep check into an async worker without changing tip/`constraint`/no-invented-`^`/exit/read-only logic
- [x] 1.3 Run remote checks via bounded pool (Resolver `runPool`-style or equivalent); assemble `rows` by lock index order after completion
- [x] 1.4 Prove with injectable delayed stubs: `0` has no overlap; `n>0` respects max in-flight and preserves lock order

## 2. CLI parse, help, JSON

- [x] 2.1 Parse `-j <n>`, `-j=<n>`, `--parallel-checks <n>`, `--parallel-checks=<n>`; invalid/missing → non-zero clear error; omit → forward `4`
- [x] 2.2 Parse `--json` (long-only); combine with `-j`/`-v`; unknown flags stay fail-closed; `-j` MUST NOT enable JSON
- [x] 2.3 On `--json` success: stdout `JSON.stringify({ dependencies: rows }, null, 2)` omitting undefined OutdatedRow keys; suppress human `text`; errors on stderr
- [x] 2.4 Update outdated help: `-j`/`--parallel-checks` (default 4, `0` serial), `--json` as bapm machine rows (no APM `--json` claim); keep report-only vs update

## 3. Tests

- [x] 3.1 Unit/CLI: parse/help for `-j`/`--parallel-checks`/`--json`; invalid values fail-closed; default 4 wired
- [x] 3.2 Core: serial `0`, bounded concurrency + lock-order with stubs; unrelated outdated tests use `parallelChecks: 0` or stubs for determinism
- [x] 3.3 CLI: `--json` shape `{ dependencies: [...] }` with OutdatedRow keys; no invented `source`; `-v --json` includes present tip_ref/detail; human table suppressed
- [x] 3.4 Regression: existing P6e outdated acceptance/unit suites remain green (algorithm/exit/read-only unchanged)
