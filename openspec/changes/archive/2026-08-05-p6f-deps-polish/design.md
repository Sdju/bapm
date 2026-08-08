## Context

See `proposal.md` for motivation. Today `whyDeps` always returns `ok: true`, `exitCode: 0` with human `→` chains only; CLI `parseDepsArgs` accepts `list`/`tree`/`why` without `--json` or `clean`. Modules wipe already exists as `cacheClean` / `bapm cache clean -y` (project `apm_modules`) — functionally ≈ APM `deps clean`, not APM shared git/http cache. Criteria: `.samples/apm-knowledge/topics/p6f-deps-polish-criteria.md`; deep-dive: `command-deep-dive-deps.md`.

## Goals / Non-Goals

**Goals:**

- Structured why result + JSON render with honest exits (`0/1/2`)
- Query match by exact `name` and exact `repo_url` at minimum
- Thin `deps clean` alias reusing `cacheClean` (same modules wipe)
- Help + fail-closed unknown flags

**Non-Goals:**

- Shared APM git/http cache; `deps info`/`view`; `--global`; interactive Rich prompts
- Basename / `owner/repo` resolution unless cheap (SHOULD)
- `--dry-run` on clean unless cheap (SHOULD)
- CONFORMANCE claim edits; reopen install/audit/lock/policy/outdated

## Decisions

### 1. Exit codes: exact APM `0` / `1` / `2`

- **Choice:** `0` = package explained; `1` = `not_installed` or `ambiguous`; `2` = `no_lockfile` (missing or unreadable lock). Map core `exitCode` through CLI `LifecycleResult` unchanged.
- **Why:** Criteria prefer APM numbers; discriminators on JSON errors reinforce the same taxonomy; `LifecycleResult.exitCode` is already a free `number` (no harness collapse to `0|1`). CI scripts can tell “no lock” from “wrong package”.
- **Alternatives considered:** Collapse all failures to `1` with only JSON `error` distinguishing — rejected for this polish (loses APM parity the change exists to restore). Document mapping table in help only if a future global CLI policy forces collapse.

### 2. JSON errors on stderr (APM)

- **Choice:** With `--json`, success document → **stdout**; error object → **stderr**; human (no `--json`) errors/messages stay on stderr/stdout as today for readable text, with non-zero exit. Do not duplicate success JSON on stderr.
- **Why:** Matches APM `why.py`; machine pipelines can redirect streams separately.
- **Alternatives:** stdout-only errors — rejected (breaks APM-shaped consumers).

### 3. Success JSON shape (truthful, not byte-clone)

- **Choice:** Stable keys:
  - `package`: `{ name?, repo_url?, version, source, is_direct }` — include both `name` and `repo_url` when present on the lock entry; `version` = tag/ref/commit fallback order used elsewhere in deps inspect; `source` from lock; `is_direct` from lock/`resolved_by` empty-as-direct convention already used in tree
  - `paths`: `[{ chain: [{ name?|repo_url?, constraint | null, is_direct }] }]` ordered deterministically (lexicographic chain join, same spirit as today’s chain sort)
- Pretty-print with indent 2; key order SHOULD be stable (`package` then `paths`; within objects prefer documented field order).
- **Why:** Criteria MUST; bapm locks often key by `name` while APM keys `repo_url` — emit both when available and document identity in design/help.
- **Alternatives:** APM-only `repo_url` identity — rejected (would lie on name-keyed bapm locks).

### 4. Error JSON discriminators

- **Choice:** `{ "error": "no_lockfile" }` | `{ "error": "not_installed", "query": "<q>" }` | `{ "error": "ambiguous", "query": "<q>", "matches": [...] }`. Extra fields allowed but `error` is required.
- **Why:** APM parity; acceptance asserts discriminator presence.

### 5. Query resolution (MUST floor + SHOULD)

- **Choice:** MUST: exact match on lock `name` **or** exact match on lock `repo_url`. Zero matches → `not_installed`; two+ distinct packages matching different exact keys for the same query form → `ambiguous` (rare for exact; reserved for SHOULD basename expansion). SHOULD if cheap: unique basename / `owner/repo` like APM `resolve_package_query`.
- **Why:** Criteria gap #4; fixtures with `repo_url` identity must work.
- **Alternatives:** Name-only (status quo) — rejected.

### 6. Human why without `--json`

- **Choice:** Keep readable chain text (existing `→` style OK; ASCII `+--` SHOULD). Empty/missing MUST NOT exit `0`: missing lock → `2` + clear message; not installed → `1` + clear message. Success still prints chains and exits `0`.
- **Why:** Criteria: “must not pretend success with exit 0 when package absent”.

### 7. `deps clean` = reuse `cacheClean`

- **Choice:** CLI subcommand `clean` parses `-y`/`--yes` (and optional `--dry-run` if cheap). Call existing core `cacheClean({ cwd, yes })` — same `apm_modules` root, same refuse-without-yes, same absent-dir success. Message MAY say `deps clean` while semantics identical. Help MUST state equivalence to `cache clean` modules wipe and MUST NOT imply shared APM git/http cache.
- **Why:** Criteria MUST; zero new storage semantics.
- **Alternatives:** Duplicate wipe logic under Deps — rejected. Interactive confirm prompts — rejected (keep bapm non-interactive refuse).

### 8. CLI parse surface

- **Choice:** Extend `parseDepsArgs`: allow `--json` only meaningful for `why` (on other subs: either ignore-as-unknown → fail-closed, prefer **fail-closed** if `--json` appears on list/tree/clean). Accept `clean` with `-y`/`--yes`. Unknown flags remain errors.
- **Why:** Fail-closed is existing deps contract.

### 9. Core API shape

- **Choice:** Extend `DepsWhyResult` with structured fields (`package`, `paths` or equivalent, `error?`, `json?` optional) while keeping `chains`/`text` for human path; set `ok`/`exitCode` honestly. Optionally add `depsClean` thin wrapper that re-exports `cacheClean` from Deps public API for CLI symmetry — or CLI imports `cacheClean` directly from Cache; prefer **CLI imports `cacheClean`** to avoid fake Deps domain for wipe (document in tasks).
- **Why:** Minimal churn; wipe stays Cache-owned.

## Risks / Trade-offs

- [Always-exit-0 why today] → **BREAKING** for scripts; intentional; call out in proposal (done).
- [Identity name vs repo_url] → JSON includes both when available; match either.
- [Exit `2` unusual in some bapm commands] → Documented; acceptance asserts `2` for no lock; do not silently map to `1`.
- [Naming confusion cache vs deps clean] → Help text explicit; no shared-cache implementation.

## Migration Plan

1. Core why types + honest exits + query match + structured paths.
2. CLI `--json` wiring (stdout/stderr) + human path exits.
3. `deps clean` → `cacheClean` + help.
4. Acceptance covering MUST gaps; list/tree regression.
5. Knowledge note P6f; no CONFORMANCE claim edits.

## Open Questions

- (resolved) Exit codes: **use APM `0/1/2`**.
- (resolved) JSON errors: **stderr**.
- `--dry-run` / basename query: ship only if apply finds them trivial; not DoD blockers.
