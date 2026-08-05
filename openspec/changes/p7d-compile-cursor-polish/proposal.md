## Why

After p7c, `bapm compile` still exposes only `--validate` while core already has `outputFile`. Operators need APM-shaped cursor polish: choose output path, preview without write (`--dry-run`), and thin source attribution (`-v`) — without multi-host compile or fake optimizer UX. Shipping this now closes the next roadmap slice (`p7d`) while keeping the single-file AGENTS.md contract honest.

## What Changes

- **CLI `-o` / `--output PATH`:** parse and wire to core `outputFile` (default `AGENTS.md`); successful non-dry-run/non-validate compile writes to that path (relative to cwd); create parent dirs as today
- **CLI `--dry-run`:** discover + render preview (path + primitives count); **never write**; exit `0` on success; UX message **distinct** from `--validate`
- **Keep `--validate`:** no write; if both `--dry-run` and `--validate` are set → **validate-first** (APM early-return)
- **CLI `-v` / `--verbose`:** thin source attribution (name + type + path when known) on compile/dry-run — not APM optimizer / distributed placement messaging
- **Core options:** add `dryRun` / `verbose` (or equivalent) so no-write / attribution live in `@bapm/core`, not CLI-only side effects
- **Help:** document `-o/--output`, `--dry-run`, `-v/--verbose`, `--validate`; unknown flags stay fail-closed
- **Foreign hosts:** still MUST NOT emit `CLAUDE.md` / `GEMINI.md` / `.github/copilot-instructions.md`
- **SHOULD (in scope — thin):** unskip / add CLI acceptance for `--validate`
- **SHOULD (DEFER):** default markdown link resolve + `--no-links` — not thin enough for this slice; **omit `--no-links` from help** until resolve ships (truthful)

**Non-goals / out:**
- `--target` / `--all` / multi-host emitters
- `-g` / `--global`, `--watch`, `--root`, `--clean`, `--single-agents`
- chatmode / constitution flags
- CONFORMANCE claim-table churn
- Fake `--no-links` without link resolve
- Absolute `--output` outside project cwd semantics expansion (keep `join(cwd, outputFile)`)
- Claiming APM optimizer / distributed placement in help

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `compile-agents-md`: Add output-path wiring, dry-run preview (no write), validate-first when combined with dry-run, thin verbose attribution via core options; keep cursor-only AGENTS.md emit and foreign-host prohibition
- `cli-runtime-surface`: Document new compile flags in help; keep unknown-flag fail-closed; no multi-host / deferred `--no-links` in help

## Impact

- `@bapm/core` Compile: extend `CompileAgentsMdOptions` / result with `dryRun` / `verbose` (and attribution payload or stdout-ready list); skip write when `validate` or `dryRun`; keep existing `outputFile`
- `bapm` CLI Compile: parse `-o/--output`, `--dry-run`, `-v/--verbose`; help text; validate-first precedence; UX messages for dry-run vs validate
- Tests: acceptance covering output path, dry-run no write, validate no write, verbose attribution, unknown flag, no foreign hosts; unskip existing `--validate` CLI test
- No CONFORMANCE.md edits; no link-resolver module in this change
