## Purpose

Defines machine-readable serialization of the existing `audit --ci` integrity gate into APM-aligned JSON and SARIF 2.1.0 for CI consumers, without changing gate semantics or expanding the check suite.

## ADDED Requirements

### Requirement: Structured CI report uses stable check taxonomy

When the audit CI gate completes, the system MUST build a structured report with exactly three checks in this order: `lockfile-exists`, `content-integrity`, `tree-sha256`. Each check MUST have `name`, `passed` (boolean), `message` (human-readable), and `details` (string array). Individual hash/presence or tree violations MUST appear as entries in that check's `details` (one check per category, not one check per file). When the lockfile is missing, `lockfile-exists` MUST fail and `content-integrity` / `tree-sha256` MUST be marked failed with a clear not-evaluated message and empty or explanatory `details` (they MUST NOT be omitted from the array). When the lock is present and a category has zero violations, that check MUST pass with empty `details`. Overall `passed` MUST be true iff every check passed. Summary MUST be `{ total, passed, failed }` counting those three checks.

#### Scenario: Clean gate yields three passing checks

- **WHEN** the audit CI gate succeeds (lock present, hashes and tree clean)
- **THEN** the structured report MUST have `passed: true`, three checks named `lockfile-exists`, `content-integrity`, `tree-sha256` in that order each with `passed: true`, and `summary.total` equal to `3` with `failed` equal to `0`

#### Scenario: Missing lock fails lockfile-exists and leaves later checks not evaluated

- **WHEN** the audit CI gate runs with no discoverable lockfile
- **THEN** `lockfile-exists.passed` MUST be false, `content-integrity` and `tree-sha256` MUST still appear (not omitted) with `passed: false`, and overall `passed` MUST be false

#### Scenario: Hash mismatch fails only content-integrity among integrity categories

- **WHEN** the lock is present and a deployed-file hash/presence violation exists while tree checks are clean
- **THEN** `content-integrity.passed` MUST be false with at least one detail naming the path, `tree-sha256.passed` MUST be true, and overall `passed` MUST be false

#### Scenario: tree_sha256 mismatch fails tree-sha256

- **WHEN** the lock is present and a git entry has missing or mismatched `tree_sha256` while deployed hashes are clean
- **THEN** `tree-sha256.passed` MUST be false with details naming the entry, and overall `passed` MUST be false

### Requirement: JSON output matches CIAuditResult shape

When format is `json`, the system MUST emit a single JSON document whose top-level keys include `passed` (boolean), `checks` (array of check objects as above), and `summary` (`total` / `passed` / `failed` numbers). Key order SHOULD be stable (`passed`, `checks`, `summary`) and pretty-print with indent 2 when cheap. The document MUST NOT include human banner lines or success prose outside the JSON structure.

#### Scenario: json format is parseable CIAuditResult shape

- **WHEN** audit runs with format `json` on a clean project
- **THEN** stdout or the `-o` file body MUST parse as JSON with `passed === true`, a `checks` array, and a `summary` object with numeric `total`, `passed`, and `failed`

#### Scenario: json format on failure includes failed checks

- **WHEN** audit runs with format `json` and the gate fails
- **THEN** the JSON MUST have `passed === false`, `summary.failed` greater than `0`, and at least one check with `passed === false`

### Requirement: SARIF 2.1.0 output for failed checks

When format is `sarif`, the system MUST emit SARIF version `2.1.0` with a `$schema` URI for the 2.1.0 schema, exactly one run, and tool driver `name` equal to `bapm-audit`. Each failed check MUST contribute one or more `results` entries with `ruleId` equal to the check `name`, `level` equal to `"error"`, and `message.text` from the check message or a detail. Locations MUST use `physicalLocation.artifactLocation.uri` with a project-relative path (lock path and/or offending file when known). The SARIF MUST NOT include file content snippets or region snippets of file bodies.

#### Scenario: sarif clean has empty results

- **WHEN** audit runs with format `sarif` on a clean project
- **THEN** the document MUST declare `version` `"2.1.0"`, driver name `bapm-audit`, and `runs[0].results` MUST be empty or absent of error findings

#### Scenario: sarif failure emits error results without snippets

- **WHEN** audit runs with format `sarif` after a hash or tree failure
- **THEN** `runs[0].results` MUST contain at least one entry with `level` `"error"` and a `ruleId` of `content-integrity` or `tree-sha256`, and result messages MUST NOT embed file body content

### Requirement: Serializers live in core public API

`@bapm/core` MUST expose a way to obtain the structured CI report and to serialize it to JSON and SARIF strings (or equivalent public helpers) so callers need not depend on the CLI. Serialization MUST be pure with respect to the project tree (no lock rewrite, install, network resolve, or target materialize). Format selection MUST NOT alter the underlying gate's pass/fail outcome for the same tree.

#### Scenario: core can serialize without CLI

- **WHEN** a library consumer obtains an audit CI result from `@bapm/core` and requests JSON or SARIF serialization
- **THEN** the consumer MUST receive the document body without invoking the `bapm` CLI binary

### Requirement: IO purity for structured bodies

When format is `json` or `sarif` and no output path is set, the report body MUST be the only non-whitespace content written to stdout for that run. When an output path is set, the report body MUST be written to that file (creating parent directories as needed), stdout MUST NOT contain the report body, and a short success diagnostic MUST go to stderr (or the CLI logger equivalent), not mixed into the file body. Format `text` MAY keep human lines on stdout as today.

#### Scenario: json to stdout is body-only

- **WHEN** `audit --ci -f json` runs without `-o`
- **THEN** stdout (trimmed) MUST be exactly the JSON document

#### Scenario: -o writes file and keeps stdout clear of body

- **WHEN** `audit --ci -f json -o report.json` succeeds
- **THEN** `report.json` MUST contain the JSON document, stdout MUST be empty of the report body (only optional whitespace), and the project lockfile and modules tree MUST be unchanged aside from the new report file
