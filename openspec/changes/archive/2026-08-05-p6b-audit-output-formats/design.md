## Context

See proposal.md — Why. Today `runAuditCi` returns `{ ok, exitCode, violations[], diagnostics[], text }` and the CLI always prints `text`. Collectors already return typed violations (`DeployedHashViolation`, `TreeSha256Violation`) before flattening to strings — enough to build stable checks without reinventing the gate. APM reference: `CIAuditResult` / `to_json` / `to_sarif` and `detect_format_from_extension`.

## Goals / Non-Goals

**Goals:**

- Stable three-check taxonomy + JSON/SARIF serializers in `@b-apm/core` (public API).
- Thin CLI: parse `-f`/`-o`, extension auto-detect (SHOULD), IO (stdout XOR file).
- Preserve exit 0/1 and fail-closed integrity (lk-015/017).

**Non-Goals:**

- Full APM baseline checks, drift, strip, policy-in-audit, markdown, multi-target.
- Byte-identical APM goldens (bapm-owned fixtures; tool name `bapm-audit`).
- Changing always-on gate quirk (`ci: true` even without `--ci`) beyond documenting formats with `--ci` in help.

## Decisions

### 1. Check taxonomy (resolved)

Always emit **exactly three** checks, fixed order:

| Order | `name`              | Source                          | Pass when                                                              |
| ----: | ------------------- | ------------------------------- | ---------------------------------------------------------------------- |
|     1 | `lockfile-exists`   | lock dual-read discovery        | lock loaded                                                            |
|     2 | `content-integrity` | `collectDeployedHashViolations` | zero hash/presence violations (also vacuously pass if inventory empty) |
|     3 | `tree-sha256`       | `collectTreeSha256Violations`   | zero tree violations                                                   |

- **One check per category**, many `details[]` (violation messages / path lines) — not one check per file.
- Missing lock: check 1 fails; checks 2–3 still present with `passed: false`, message like `not evaluated (lockfile missing)`, `details: []` — keeps `summary.total === 3` stable for CI consumers.
- Names align APM CI (`lockfile-exists`, `content-integrity`) plus bapm-specific `tree-sha256` for lk-015 (APM folds tree into broader integrity paths; we keep an explicit ruleId for scanning).

**Alternatives rejected:** single opaque `integrity` check (poor SARIF ruleIds); one check per violation (unstable `summary.total`); omitting later checks on fail-fast (breaks stable schema).

### 2. Core owns model + serializers; CLI owns argv + file IO

- Refactor `runAuditCi` to build structured checks **before** flattening text; extend `AuditCiResult` with `checks` (and derived `passed` / keep `ok`/`exitCode`/`text`/`violations` for compat).
- Pure helpers on public API, e.g. `formatAuditCiJson(result): string`, `formatAuditCiSarif(result): string` (+ types `AuditCiCheck`, `AuditCiStructuredReport` as needed).
- Optional `format?: 'text'|'json'|'sarif'` on `RunAuditCiOptions` MAY return `body` / set `text` to the serialized document for convenience; **file write stays in CLI** so stream discipline (stderr success vs body) is explicit at the boundary.
- CLI: parse flags → `runAuditCi` → serialize if needed → `console.log` body XOR `mkdir`+write file + stderr diagnostic.

**Alternatives rejected:** CLI-only serializers (harder reuse / acceptance from core); core writing `-o` (mixes process IO into library).

### 3. SARIF mapping

- `$schema` + `version: "2.1.0"`; one run; `driver.name: "bapm-audit"`; `driver.version` from package version when cheap.
- Failed checks → `results[]`: one result per detail (or message if no details); `ruleId = check.name`; `level: "error"`.
- `uri`: prefer offending relative path from violation (`DeployedHashViolation.path`, package/entry label for tree); else discovered lock basename/relative path (`apm.lock.yaml` / `bapm.lock.yaml`).
- No `snippets` / no file body in messages beyond existing diagnostic strings (hash envelopes OK).

### 4. Format resolution

1. Explicit `-f` / `--format` → use it (unknown → exit 1).
2. Else if `-o` present → detect: `.sarif` / `.sarif.json` → sarif; `.json` → json; else text. `.md` → treat as unsupported for this command (fail-closed; markdown out of scope).
3. Else → `text`.

Explicit `-f` always wins over extension (even if extension disagrees).

### 5. Text mode

Keep current human lines on stdout (`Audit CI clean` / joined violations). Structured `checks` still built internally for API consumers even when format is text.

## Risks / Trade-offs

- [Mapping free-form strings → names] → Mitigation: build checks from typed collectors inside `runAuditCi`, not by parsing `violations[]` text.
- [Banner pollution on JSON stdout] → Mitigation: CLI branches; acceptance asserts trimmed stdout === body when no `-o`.
- [Always-on gate without `--ci`] → Mitigation: help documents `--ci`; formats work whenever gate runs; no behavior change to require `--ci` in this slice.
- [Temptation to add APM baseline checks] → Mitigation: taxonomy fixed at three; scopeOut in proposal.

## Migration Plan

- Additive flags/API; default `text` preserves current UX.
- Existing tests that assert text/exit remain green; add format cases.
- No lock schema migration; no CONFORMANCE claim-table churn (optional soft note only).

## Open Questions

- None blocking. Optional later: whether bare `audit` without `--ci` should refuse structured formats — defer; gate already always-on.
