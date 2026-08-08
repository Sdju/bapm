## Why

After P6f, `deps why` resolves only exact lock `name` or exact `repo_url`. Operators and APM-shaped scripts still expect short-form queries (`shared-utils`, `acme-org/shared-utils`) that APM resolves uniquely from `repo_url`. Without that, honest failures look like `not_installed` for packages that are present. Optional `deps clean --dry-run` remains deferred from P6f and is cheap to ship with the same wipe path.

## What Changes

- **`deps why` short-form resolve (MUST):** after exact `name` / exact `repo_url`, resolve a unique **`owner/repo`** then a unique **basename** derived from lock `repo_url` (strip trailing `.git`; last two / last path segments)
- **Ambiguous short-form:** ≥2 matches at a form → exit `1`, `error: ambiguous`, JSON stderr includes `query` + `matches` (preserve P6f object identity shape — see design)
- **Precedence:** exact forms win over short forms so an exact `name`/`repo_url` hit never loses to a basename/`owner/repo` collision
- **Preserve P6f:** exits `0/1/2`, success JSON (`package`+`paths`), error JSON on stderr, offline lock-only walk, exact `name`|`repo_url` unchanged
- **Help:** document basename / `owner/repo` examples; unknown flags stay fail-closed
- **SHOULD (in scope — thin):** `deps clean --dry-run` previews modules wipe (count and/or entry names), **no delete**, **no `-y` required**; wire via `cacheClean({ dryRun })`; absent `apm_modules` → exit `0` / would-remove 0
- Help lists `--dry-run` only if shipped (truthful)

**Non-goals / out:**

- `--global` / `-g`
- CONFORMANCE claim-table edits
- Shared APM git/http cache semantics
- Arbitrary pick among ambiguous short-form matches
- Weakening P6f exits / JSON / exact match
- Delete under `--dry-run`; interactive confirm prompts (keep refuse-without-`-y` for real wipe)
- `deps info` / `view`; richer human ASCII `+--` polish

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `deps-inspect`: Promote short-form why resolution (unique `owner/repo` + unique basename after exact; ambiguous + matches; precedence) from MAY/SHOULD to MUST; optional `deps clean --dry-run` preview semantics when shipped
- `cli-runtime-surface`: Document short-form why examples in deps help; accept/document `--dry-run` on `deps clean` if shipped; keep unknown-flag fail-closed
- `cache-cli-ux`: Extend modules wipe with optional dry-run preview via core `cacheClean` (deps clean consumes it; `cache clean --dry-run` MAY share the same path for symmetry)

## Impact

- `@bapm/core` Deps: extend `findExactMatches` / query resolve in `whyDeps` with `owner/repo` + basename helpers; keep `DepsWhyResult.matches` object shape
- `@bapm/core` Cache: optional `dryRun` on `cacheClean` / result fields for would-remove preview
- `bapm` CLI Deps: help + parse `--dry-run` on clean; no change to why `--json` stream/exit wiring beyond richer resolve
- Acceptance: unique basename; unique owner/repo; ambiguous basename; `.git` strip; P6f exact + `--json` + exits regressions; dry-run no-delete if shipped
- No CONFORMANCE.md edits; no `--global`
