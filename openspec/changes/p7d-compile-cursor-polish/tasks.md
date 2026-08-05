## 1. Core compile options

- [ ] 1.1 Extend `CompileAgentsMdOptions` with `dryRun?: boolean` and `verbose?: boolean`; extend result with thin attribution list (`name`, `type`, `path?`) when useful for CLI
- [ ] 1.2 Write only when `!validate && !dryRun`; `validate` wins over `dryRun` (no write either way); keep `outputFile` + parent mkdir as today
- [ ] 1.3 Unit-test: dryRun no write; validate no write; custom `outputFile` write path; attribution fields present when verbose/primitives have path

## 2. CLI compile surface

- [ ] 2.1 `parseCompileArgs`: accept `-o`/`--output PATH`, `--dry-run`, `-v`/`--verbose`, `--validate`; missing `-o` value → error; unknown flags fail-closed
- [ ] 2.2 Wire `compileAgentsMd({ cwd, outputFile, validate, dryRun, verbose })`; validate-first messaging when both validate+dry-run
- [ ] 2.3 UX: dry-run prints would-write path + primitives count (distinct from validate); verbose prints thin name/type/path lines; happy-path write message uses chosen path
- [ ] 2.4 Update `formatCompileHelp`: document `-o/--output`, `--dry-run`, `-v/--verbose`, `--validate`; omit `--no-links` and multi-host flags

## 3. Tests + hygiene

- [ ] 3.1 Unskip/add CLI test for `--validate` no write
- [ ] 3.2 Acceptance: `-o` custom path write; `--dry-run` no write + preview; `--validate` no write + distinct message; validate+dry-run → validate-first
- [ ] 3.3 Acceptance: `-v` thin attribution; unknown flag fail-closed; help lists polish flags; no CLAUDE/GEMINI/copilot files
- [ ] 3.4 No CONFORMANCE claim-table edits; no link resolver / fake `--no-links`; no `--target`/`--global`/`--watch`/`--root`/`--clean`/`--single-agents`
