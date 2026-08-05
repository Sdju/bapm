## Why

Bare `bapm lock` still soft-ignores unknown `-…` argv (P6c deferred), so typos like `--not-a-real-flag` still resolve and write a lockfile. APM Click and bapm `install` fail-closed; this slice closes that parity gap without implementing `--global` / `--target`.

## What Changes

- **BREAKING (argv):** bare `lock` rejects unrecognized flags starting with `-` with non-zero exit and a clear `Unknown lock flag: …` error; MUST NOT call resolve/write on that path.
- Keep P6c allowlist: `--update`, `-v`/`--verbose`, `--parallel-downloads` (space/`=`), `--policy` (space/`=`), `--no-policy`, `-h`/`--help`.
- Reject APM-only `-g`/`--global`/`-t`/`--target` as unknown (do not implement).
- Prefer fail before resolve/write; print parse errors on stderr consistently with install/export (SHOULD).
- Unexpected positionals on bare `lock` fail-closed (SHOULD, cheap).
- Keep `lock export` fail-closed; no CONFORMANCE claim churn; no lockfile schema / OpenAPM class changes.

**Non-goals:** `--global` / user-scope / multi-target lock; changing known-flag resolve/write semantics; CONFORMANCE.md edits; SBOM/export format work beyond regression guard.

## Capabilities

### New Capabilities

- _(none)_ — behavior tightens existing lock CLI surface.

### Modified Capabilities

- `lock-command`: bare-lock argv fail-closed for unknown flags (and SHOULD unexpected positionals); keep known P6c flags + help; preserve export fail-closed; no resolve/write on parse error.
- `cli-runtime-surface`: dispatch-level parity that bare `lock` hard-rejects unknown flags like install (stderr names the flag; non-zero exit).

## Impact

- `packages/cli` Lock module: `parseLockArgs` / `runLock` / help (no new flags advertised).
- Tests: acceptance + existing `packages/cli/tests/lock/` regressions for known flags and export unknowns.
- No `@bapm/core` resolve/lock schema changes expected; no CONFORMANCE / claim-table edits.
