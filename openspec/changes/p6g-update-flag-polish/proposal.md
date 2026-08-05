## Why

Post-P6f, OpenAPM-relevant `bapm update` already works (`-y`, `--dry-run`, scoped packages, confirm, policy), but the CLI still lacks APM-aligned thin polish: `-v`/`--verbose` (quieter plan that hides `keep` / `[=]` rows) and `--parallel-downloads` (core already accepts `parallelDownloads`). Closing this ergonomics gap (P6g) without claiming APM `--force`, view/deps info, or global/multi-target.

## What Changes

- Accept **`-v` / `--verbose`** on `bapm update`; without it, printed plan **omits** `action: "keep"` rows (APM `render_plan_text` parity); with it, include `[=]` / keep lines. Empty-change messaging stays honest (no false “updated”).
- Accept **`--parallel-downloads <n>`** (and `=` form): int; default **4** when omitted; **`0` = serial**; wire into core `runUpdate` → `resolveAndLock`.
- Update **help** to document both flags (incl. `0` = serial).
- Keep fail-closed unknown flags; preserve `-y`, `--dry-run`, packages scope, `--policy` / `--no-policy`, non-TTY requires `-y`.

**Non-goals / MUST NOT:** APM `--force` (security overwrite) under that name; `--global` / multi `--target`; `deps info` / `view`; `deps update` alias; CONFORMANCE claim-table edits; new OpenAPM MUST claims; reopen P1–P6f.

## Capabilities

### New Capabilities

- _(none)_ — behaviour extends existing update / CLI surfaces.

### Modified Capabilities

- `lifecycle-update`: Gate printed plan `keep`/`[=]` rows on verbose; accept `parallelDownloads` / `verbose` on core update options (default concurrency 4; `0` serial).
- `cli-runtime-surface`: Expose `-v`/`--verbose` and `--parallel-downloads` on `update`; document in help; keep unknown-flag fail-closed.

## Impact

- `packages/cli` Update: `parseUpdateArgs` / `formatUpdateHelp` / `runUpdateCli` — mirror install flag parsing for `-v` and `--parallel-downloads`; pass through to core.
- `packages/core` Update: `RunUpdateOptions.verbose`; `formatPlan` (or caller) filters `keep` unless verbose; ensure omitted `parallelDownloads` defaults to 4 at the resolve path (or explicit pass from CLI).
- Acceptance: dry-run without `-v` hides keep; with `-v` shows keep; `--parallel-downloads 0` accepted; help lists flags; unknown flag fails; existing update lifecycle tests green.
- No CONFORMANCE.md claim-table edits; knowledge criteria already choose hide-keep-unless-verbose.
