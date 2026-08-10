## Why

Gap1 (APM CLI parity) leaves users without a local package inspect surface: after install they can `deps list`/`deps why` but cannot run APM-shaped `view <package>` to see name, pin/ref, on-disk modules path, and package summary. apm-expert scoped Gap1 to **implement-now local view only** (no `--registry` / remote versions; unpack already covered by install-from-zip). Shipping a thin offline `bapm view` closes that gap next to existing deps inspection.

## What Changes

- Add top-level **`bapm view <package>`** (APM command name; preferred over nesting under `deps`)
- Offline inspect of one installed lock package: identity (name / repo), version or lock ref, path under project `apm_modules`, and summary/description from the package manifest when present
- Resolve `<package>` with the same offline lock query forms as `deps why` (exact `name` / `repo_url`, then unique `owner/repo`, then unique basename)
- Honest exits aligned with other inspect commands: `0` success, `1` not installed / ambiguous / missing package arg, `2` missing/unreadable lock
- FEOD CLI: new `View` module + thin `commands/view`; core logic via `@b-apm/core` public API (no deep imports)
- Help / top-level usage lists `view`; unknown flags fail-closed
- Optional SHOULD: short VitePress reference page; optional hidden `info` alias (APM) — not required for MVP green

**Non-goals / out:**

- `view <package> versions`, `--registry`, network / remote tags / registry version tables
- `-g` / `--global` / `~/.apm` user-scope modules
- Marketplace `NAME@MARKETPLACE` plugin view
- Rich/panel UI; `--json` machine output (defer)
- `deps info` / `deps view` alias unless trivial reuse of the same core API (prefer top-level `view`)
- CONFORMANCE claim-table edits; multi-target; source-analysis acceptance tests
- Full docs rewrite

## Capabilities

### New Capabilities

- `view-local-inspect`: Offline core orchestration to resolve a lock package query, locate its modules tree path, read optional package-manifest summary, and return structured view result + human text (no network)
- `cli-view`: Top-level FEOD `bapm view <package>` wiring, help, fail-closed unknown flags, exit codes 0/1/2

### Modified Capabilities

- `cli-runtime-surface`: Register top-level `view`; top-level help MUST list `view`

## Impact

- `@b-apm/core`: new View (or Deps-adjacent) public API for local package inspect; reuse lock load + query resolve helpers; reuse existing modules-path location (`locateGitPackageTree` or equivalent); read package `apm.yml`/`bapm.yml` for summary/description when present
- `bapm` CLI: `modules/View`, `commands/view`, registry + help constants
- Acceptance: behavioural CLI/core fixtures only (installed package view; missing package; missing lock; ambiguous query; help; unknown flag) — no source/AST inspection
- Docs: optional short `apps/docs/reference/view.md` + sidebar link in tasks (not a blocker for product green)
