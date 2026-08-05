## 1. Core structured report + serializers

- [ ] 1.1 Extend Audit types: `AuditCiCheck` (`name`/`passed`/`message`/`details`) and add `checks` to `AuditCiResult` (keep `ok`/`exitCode`/`violations`/`diagnostics`/`text`)
- [ ] 1.2 Refactor `runAuditCi` to build the three checks in order (`lockfile-exists`, `content-integrity`, `tree-sha256`) from lock load + typed collectors; derive `violations`/`text`/`exitCode` from checks; missing-lock marks later checks not-evaluated
- [ ] 1.3 Implement pure `formatAuditCiJson` (indent 2, stable key order `passed`/`checks`/`summary`) and `formatAuditCiSarif` (2.1.0, driver `bapm-audit`, no snippets; uri from path/lock)
- [ ] 1.4 Export new types + serializers from Audit module and `@bapm/core` public API; optional `format` on options returning serialized body without file IO

## 2. CLI flags and IO

- [ ] 2.1 Parse `--format`/`-f` and `--output`/`-o`; unknown format fail-closed; implement extension auto-detect when `-f` omitted (`.sarif`/`.sarif.json` → sarif, `.json` → json; `.md` unsupported)
- [ ] 2.2 Wire run path: text → stdout as today; json/sarif → body stdout XOR write file (mkdir parents) + stderr success diagnostic; no project durable mutation beyond `-o` target
- [ ] 2.3 Update `formatAuditHelp` for `--ci`, `-f text|json|sarif`, `-o path`

## 3. Tests and verification

- [ ] 3.1 Core unit tests: clean → three passing checks + json `passed:true`; missing lock; hash tamper → `content-integrity` fail; tree missing/mismatch → `tree-sha256` fail; sarif skeleton + error results
- [ ] 3.2 CLI tests: `-f json`/`sarif` exit codes; `-o` file written and stdout empty of body; unknown `-f`; extension auto-detect; explicit `-f` wins; help mentions flags; text regression still green
- [ ] 3.3 Confirm exit contract unchanged vs text for same fixtures (no lk-015/017 softening)

## 4. Docs / soft notes

- [ ] 4.1 Optional soft CONFORMANCE/parity note: audit formats = ergonomics, not new OpenAPM class (no claim-table churn)
- [ ] 4.2 Keep knowledge/roadmap pointers consistent if editing outside change allowlist is requested separately
