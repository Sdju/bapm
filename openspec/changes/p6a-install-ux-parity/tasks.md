## 1. Core options and dry-run path

- [x] 1.1 Extend `RunInstallOptions` with `dryRun`, `packageRefs` (or equivalent), and `excludeTargets` / exclude set; keep `parallelDownloads` / `verbose` as-is
- [x] 1.2 Implement dry-run early path in `runInstall`: load/discover manifest (no create unless previewing positional), preview direct deps + MCP view, optional policy preflight on directs, return success diagnostics; assert no write-side calls (materialize, configureMcp, lock write, orphan delete, archive extract, modules durable download)
- [x] 1.3 Unit tests: dry-run leaves fixture tree bit-identical; dry-run does not invoke target write ports

## 2. Positional package-ref add

- [x] 2.1 Implement package-ref validate + append to `dependencies.apm` with dual-read write-back; auto-create minimal `apm.yml`/`bapm.yml` when missing and refs present (non-dry-run, non-frozen)
- [x] 2.2 Wire zip vs package-ref classification; reject zip+refs mix; reject effective frozen × positional (non-dry-run); dry-run positional previews without write
- [x] 2.3 Core/unit tests for add, auto-create, frozen reject, dry-run positional, zip unchanged

## 3. Exclude, parallel, verbose in core

- [x] 3.1 Honor `exclude` so `cursor` skips `configureMcp` (warn OK); unknown exclude id fail-closed
- [x] 3.2 Ensure `parallelDownloads` (`0` = serial) and `verbose` flow through download/diagnostics without weakening frozen/policy
- [x] 3.3 Confirm `bapm-target-api` / `bapm-target-cursor` have no `dryRun` fields or branches

## 4. CLI surface

- [x] 4.1 Extend `parseInstallArgs` / `formatInstallHelp` for `--dry-run`, package refs vs `.zip`, `--parallel-downloads`, `-v`/`--verbose`, `--exclude`; keep unknown-flag hard reject
- [x] 4.2 Pass new options into `coreRunInstall`; frozen×positional and dry-run positional behavior at CLI
- [x] 4.3 CLI tests for flag parse, help mentions, dry-run no writes, exclude cursor skips MCP json

## 5. Docs and soft frozen note

- [x] 5.1 Thin help/CONFORMANCE soft note: frozen integrity kept (lk-015/017/018); MCP sync optional/default-off; `--exclude` = MCP filter not skip-install
- [x] 5.2 Do not enable fail-closed frozen MCP config sync by default (SHOULD only / opt-in stub OK)
