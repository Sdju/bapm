## 1. Core update options + plan text

- [x] 1.1 Add `verbose?: boolean` to `RunUpdateOptions`; thread into both dry-run and post-apply `formatPlan` calls
- [x] 1.2 Gate `formatPlan`: omit `action === "keep"` rows unless `verbose`; when no printable rows remain, emit honest empty-change messaging (existing “No dependency changes planned” or equivalent)
- [x] 1.3 Ensure omitted `parallelDownloads` resolves to default **4** on the mutating resolve path; explicit `0` stays serial; do not weaken frozen/policy/dry-run
- [x] 1.4 Unit coverage (core): quiet vs verbose plan text; `parallelDownloads: 0` reaches resolve ports / options

## 2. CLI update flags

- [x] 2.1 Extend `parseUpdateArgs` with `-v`/`--verbose` and `--parallel-downloads` / `=` (mirror install: finite `n >= 0`, floor; missing/invalid → error)
- [x] 2.2 Wire `verbose` + `parallelDownloads` into `coreRunUpdate` from `runUpdateCli`
- [x] 2.3 Update `formatUpdateHelp` to document `-v`/`--verbose` and `--parallel-downloads` (default 4; `0` = serial)
- [x] 2.4 Confirm unknown flags still fail-closed; no APM `--force` CLI exposure

## 3. Acceptance + regression

- [x] 3.1 Acceptance: `update --dry-run` without `-v` does not print keep/`[=]` for unchanged deps; all-keep fixture stays honest
- [x] 3.2 Acceptance: `update --dry-run -v` prints keep/`[=]` rows
- [x] 3.3 Acceptance: `--parallel-downloads 0` accepted (dry-run or `-y` path); invalid value → non-zero; help lists both flags
- [x] 3.4 Regression: existing `-y` / `--dry-run` / scope / policy / non-TTY `-y` / unknown-flag tests stay green; **no** CONFORMANCE claim-table edits
