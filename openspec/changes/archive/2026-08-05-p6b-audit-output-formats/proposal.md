## Why

bapm already implements the OpenAPM integrity CI gate (`audit --ci`: lock presence, deployed hashes / lk-017, `tree_sha256` / lk-015) but only emits human text on stdout. CI pipelines and GitHub Code Scanning need machine-readable **json** / **sarif** (APM parity for formats), without inventing a second integrity engine or expanding the check suite.

## What Changes

- Add `--format` / `-f` ∈ `{text,json,sarif}` (default `text`) and `--output` / `-o <path>` on `bapm audit` (documented with `--ci`).
- Serialize the **existing** gate into APM-aligned **CIAuditResult-shaped JSON** (`passed` / `checks` / `summary`) and **SARIF 2.1.0** (tool driver `bapm-audit`); no content snippets.
- Prefer serializers + structured check model in **`@bapm/core`** (public API); thin CLI parse/IO.
- **IO purity:** json/sarif body on stdout XOR `-o` file; success/diagnostic for file write on stderr; unknown `-f` fail-closed.
- **SHOULD:** auto-detect format from `-o` extension when `-f` omitted; stable check order; pretty JSON (`indent: 2`).
- Exit 0/1 semantics unchanged; do **not** weaken lk-015/017.

**Non-goals / scopeOut:** Unicode strip / `--strip`; install-replay drift / `--no-drift`; org-policy-in-audit; external scanners; markdown format; multi-target; expanding CI suite to full APM baseline; reopening P6a/c/d; OpenAPM claim-table churn.

## Capabilities

### New Capabilities

- `audit-output-formats`: structured CI report model, JSON/SARIF serializers, format taxonomy, stream/IO rules for audit output (wrapping existing `runAuditCi` gate).

### Modified Capabilities

- `cli-runtime-surface`: expose `--format`/`-f`, `--output`/`-o` (and help) for `audit`; keep unknown-flag fail-closed; preserve exit mapping to `audit-integrity`.
- `audit-integrity`: clarify that structured formats MUST NOT change pass/fail vs text for the same tree (exit contract unchanged); gate still owns integrity — formats only serialize outcomes.

## Impact

- `@bapm/core` Audit: structured checks from gate results; `formatAuditCiJson` / `formatAuditCiSarif` (names flexible); public API options for format/output path or serialize-after-run.
- `bapm` CLI Audit: parse/help/run for `-f`/`-o`; mkdir parents on `-o`; stderr success diagnostic when writing file.
- Tests: core unit + CLI acceptance (clean json, tamper json/sarif + exit 1, `-o` empty stdout body, unknown `-f`).
- Help strings; optional soft parity/CONFORMANCE note that formats are ergonomics, not a new OpenAPM class.
- Knowledge: P6b in flight linked from deep-dive (outside openspec allowlist for this commit if under `.samples/`).
