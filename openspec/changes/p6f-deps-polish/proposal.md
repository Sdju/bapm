## Why

After P6e, `deps list` / `tree` / human `why` exist, but `deps why` is human-only and always exits `0` even when the lock is missing or the package is absent — breaking machine consumers and APM parity. Modules wipe already lives as `cache clean -y` (≈ APM `deps clean`), yet the APM-facing name `deps clean` is missing. P6f closes this inspect polish without new resolver/storage semantics or shared git/http cache.

## What Changes

- **`deps why --json`:** emit a stable machine document on stdout for success (`package` + `paths`); offline lock-only walk
- **Honest exits (BREAKING for scripts that assumed always-0):** success → `0`; not installed / ambiguous → `1`; missing/unreadable lock → `2` (exact APM `0/1/2`)
- **JSON errors:** on failure with `--json`, emit `{ "error": "no_lockfile" | "not_installed" | "ambiguous", ... }` on **stderr** (APM-aligned)
- **Query match:** resolve at least by exact lock `name` and exact `repo_url` (basename / `owner/repo` SHOULD if cheap)
- **`deps clean` (+ `-y`/`--yes`):** thin alias that performs the **same** project `apm_modules` wipe as `cache clean` (reuse core `cacheClean`); without `-y` refuse non-zero; absent dir = already clean success
- Help documents `why --json` and that `deps clean` ≡ modules wipe / `cache clean` (not APM shared git/http cache)
- Unknown deps flags remain fail-closed; list/tree behavior unchanged
- **Out / non-goals:** shared APM git/http `cache clean`/`prune`; `deps info`/`view`; `--global`; deprecated `deps update`; CONFORMANCE claim-table edits; reopen P1–P6e

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `deps-inspect`: Promote why from soft SHOULD to MUST with JSON success/error shapes, APM-aligned exit codes, name+`repo_url` query match, and `deps clean` modules-wipe alias semantics
- `cli-runtime-surface`: Register `deps why --json` and `deps clean` (`-y`/`--yes`); update deps help; keep unknown-flag fail-closed

## Impact

- `packages/core`: `whyDeps` result/types (package meta, paths/chains, `ok`/`exitCode`, error discriminator); optional thin reuse of `cacheClean` for deps clean if exposed via Deps
- `packages/cli`: `parseDepsArgs` / `runDeps` / help — `--json` on why; subcommand `clean` with yes; stdout/stderr wiring
- Acceptance/unit: JSON keys stable; missing package ≠0; no lock ≠0 (`2`); transitive chain; `deps clean -y` ≡ `cache clean -y`; human why still works; list/tree green
- Knowledge/roadmap: P6f in flight; **no** CONFORMANCE.md claim-table edits
