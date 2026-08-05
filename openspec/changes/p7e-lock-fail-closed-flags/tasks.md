## 1. Bare lock argv fail-closed

- [ ] 1.1 In `parseLockArgs`, replace soft-ignore fallthrough with fail-closed: unknown `-…` → `Unknown lock flag: ${arg}`; unexpected positional → `Unexpected lock argument: ${arg}`
- [ ] 1.2 Keep P6c allowlist intact (`--update`, `-v`/`--verbose`, `--parallel-downloads` space/`=`, `--policy` space/`=`, `--no-policy`, `-h`/`--help`); do not allowlist `-g`/`--global`/`-t`/`--target`
- [ ] 1.3 In `runLock`, on `parsed.error` print via `console.error` then return non-zero before `resolveAndLock` (no resolve/write)

## 2. Help and export regression guard

- [ ] 2.1 Confirm `formatLockHelp` still documents only known options (no `--global`/`--target`); adjust only if drift found
- [ ] 2.2 Leave `parseExportArgs` fail-closed path unchanged; verify unknown export flag still errors

## 3. Verification

- [ ] 3.1 Extend CLI/unit lock tests: unknown bare flag fails + no write; `-g`/`--global`/`-t`/`--target` unknown; known-flag happy paths still green; unexpected positional fails; stderr contains parse error
- [ ] 3.2 Assert export unknown flag still fail-closed; no harness deploy from lock; no CONFORMANCE edits
- [ ] 3.3 Run targeted `vp`/vitest for `packages/cli` lock tests; fix regressions
