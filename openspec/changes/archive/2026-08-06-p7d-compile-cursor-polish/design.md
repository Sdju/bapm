## Context

See `proposal.md` for motivation. Baseline: CLI `runCompile.ts` parses only `--validate` / `-h`; core `compileAgentsMd` already has `outputFile` (default `AGENTS.md`) and skips write when `validate`, but has no `dryRun` / `verbose` and no link resolve. Criteria: `.samples/apm-knowledge/topics/p7d-compile-cursor-polish-criteria.md`; deep-dive: `command-deep-dive-compile.md`. APM reference: compile CLI flags + validate early-return before compile; `CompilationConfig.dry_run` / verbose attribution.

## Goals / Non-Goals

**Goals:**

- Wire CLI polish flags to core options; validate-first when both dry-run+validate
- Distinct UX: validate vs dry-run would-write preview
- Thin verbose attribution (name/type/path); keep cursor-only AGENTS.md
- Truthful help (no deferred `--no-links`, no multi-host flags)

**Non-Goals:**

- Markdown link resolve / `--no-links` (DEFER — see Decisions)
- Absolute `--output` outside cwd; multi-host / global / watch / clean / root / single-agents
- CONFORMANCE churn; APM optimizer messaging

## Decisions

### 1. Core owns dryRun / verbose (not CLI-only)

- **Choice:** Extend `CompileAgentsMdOptions` with `dryRun?: boolean` and `verbose?: boolean`. Write guard: write only when `!validate && !dryRun`. Optionally return `sources` / attribution list on the result for CLI to print when `verbose`, or print from CLI using the same discovered set already sorted for render — prefer returning a small `attribution: { name, type, path? }[]` (or reuse sorted primitives fields) from core so CLI stays thin.
- **Why:** Criteria SHOULD S4; avoids duplicating discover/render in CLI for preview.
- **Alternatives:** CLI skips `writeFileSync` after calling core with always-write — rejected (would write then need delete, or force validate misuse). Separate `previewCompile` API — rejected (duplication).

### 2. Validate-first precedence

- **Choice:** If `validate === true`, treat as validate path regardless of `dryRun` (APM early-return). CLI may still pass both flags through; core ignore `dryRun` when validating. Message: existing validate line (`compile --validate ok (N primitives; no write)`), never dry-run would-write as primary.
- **Why:** Criteria MUST #4; matches APM.
- **Alternatives:** Error if both set — rejected (APM allows both with validate winning). Dry-run wins — rejected.

### 3. Dry-run UX message shape

- **Choice:** Human stdout roughly: `compile --dry-run: would write <path> (N primitives)` (exact wording flexible). Must include path + count; must differ from validate text. Exit `0` on success.
- **Why:** Criteria MUST #3 + truthfulness rule 3.
- **Alternatives:** Dump full rendered body to stdout — optional later; not required for p7d MUST.

### 4. Output path stays cwd-relative join

- **Choice:** Keep `join(cwd, outputFile)`. CLI passes `-o` value as `outputFile` string. Parent `mkdirSync` recursive unchanged. Do not special-case absolute paths in this change.
- **Why:** Criteria open question default; enough for polish.
- **Alternatives:** `path.isAbsolute` passthrough like APM Path — defer unless a later criteria expands.

### 5. Verbose = thin attribution only

- **Choice:** On compile or dry-run with verbose, print one line per primitive: name, type, path when known (skip empty path). No “optimizer”, “placement”, or multi-host language in help or stdout.
- **Why:** Criteria MUST #5; APM `-v` is richer — bapm stays thin.
- **Alternatives:** Dump full body — rejected as default verbose (noise). Silent verbose — rejected.

### 6. DEFER link resolve + `--no-links`

- **Choice:** Do **not** implement `resolve_markdown_links` or `--no-links` in p7d. Do **not** list `--no-links` in help. Body dump remains as today (raw primitive content).
- **Why:** Not thin (new resolver + edge cases http(s)/anchors/missing files); criteria allow DEFER with truthful help.
- **Alternatives:** Ship S1/S2 in same apply — rejected for scope risk; follow-up change can add resolve + flag + help together.

### 7. Help + fail-closed

- **Choice:** Update `formatCompileHelp` Usage/Options for `-o/--output`, `--dry-run`, `-v/--verbose`, `--validate`. Parser: accept those flags; any other `-…` → unknown fail-closed (existing posture). `--output` / `-o` require a following PATH token; missing value → error (non-zero).
- **Why:** Criteria MUST #6.
- **Alternatives:** Positional output path — rejected (APM uses `-o`).

### 8. Unskip validate CLI test

- **Choice:** Unskip `compile.test.ts` `--validate` case and/or cover in acceptance suite; keep foreign-host assertions.
- **Why:** Criteria SHOULD S3 + MUST #8.

## Risks / Trade-offs

- [Users expect `--no-links` from APM docs] → Help omits it; design/proposal mark DEFER explicitly; no fake flag.
- [Both flags confuse operators] → Validate-first + distinct messages; acceptance covers combined case.
- [Verbose floods large projects] → Acceptable for polish; thin lines only; no optimizer dump.
- [Relative `-o` escapes via `..`] → Same as today for nested parents; no chroot — out of scope.

## Migration Plan

1. Core types + `compileAgentsMd`: `dryRun`/`verbose`; write guard; attribution on result.
2. CLI parse/help/UX: wire flags; validate-first; dry-run vs validate messages.
3. Unskip/add CLI `--validate` test; acceptance RED→GREEN for MUST scenarios.
4. No CONFORMANCE / roadmap claim edits in apply (roadmap **done** only after archive).

## Open Questions

- _(none)_ — links deferred; output path cwd-relative decided; attribution fields fixed to name/type/path.
