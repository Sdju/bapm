## Context

See `proposal.md` for motivation. Post-P6e, core `runOutdated` walks lock deps in a sequential `for`, returns `rows: OutdatedRow[]`, and formats human `text`. CLI parses only `-v`/`--verbose`. APM `outdated` exposes `--parallel-checks`/`-j` (default 4, `0` = serial) with ThreadPoolExecutor + reorder to lock order; APM has **no** `--json`. Install/update already parse `--parallel-downloads` / `=<n>` with the same default/`0` semantics; Resolver `runPool` is the in-repo concurrency pattern. Criteria: `.samples/apm-knowledge/topics/p7b-outdated-machine-output-criteria.md`.

## Goals / Non-Goals

**Goals:**

- Wire real bounded concurrency for remote outdated checks; preserve lock order
- CLI parity for `-j` / `--parallel-checks`; default 4 / `0` serial / fail-closed parse
- Ship thin `--json` from existing `OutdatedRow` (locked shape below)
- Keep P6e tip/`constraint`/exit/read-only algorithm untouched aside from scheduling

**Non-Goals:**

- Changing check semantics per dep; `--global`; marketplace/registry; full-SHA→tag (p7g)
- CONFORMANCE claim edits; inventing APM-only JSON fields; binding `-j` to JSON
- New shared git cache or progress UI parity

## Decisions

### 1. Include `--json` in this change (not DEFER)

- **Choice:** Ship `--json` together with `-j`. Core already returns `rows`; CLI only needs a serialize branch and help text.
- **Why:** Criteria SHOULD + “include if thin”; avoids a follow-up slice for a one-liner emitter.
- **Alternatives:** `-j`-only and DEFER JSON — rejected; rows substrate is already there.

### 2. JSON top-level shape: wrapper object

- **Choice:** Success stdout is pretty-printed JSON:

```json
{
  "dependencies": [
    {
      "name": "…",
      "status": "outdated" | "up-to-date" | "unknown",
      "current": "…",
      "latest": "…",
      "repo_url": "…",
      "tip_ref": "…",
      "detail": "…"
    }
  ]
}
```

- Keys on each element are **exactly** core `OutdatedRow` field names (`name`, `status`, optional `current` / `latest` / `repo_url` / `tip_ref` / `detail`). Omit keys whose values are `undefined` (do not emit `null` placeholders for absent optionals).
- **Why:** Extensible without BREAKING a bare-array consumers later; mirrors “dependencies” lock vocabulary; tests lock `{ dependencies: [...] }`.
- **Alternatives:** Bare `OutdatedRow[]` — thinner but harder to version; rejected. APM-shaped `package`/`source`/`extra_tags` — invents fields bapm does not compute; FORBIDDEN.

### 3. Verbose-gated optional fields

- **Choice:** `tip_ref` / `detail` appear in JSON only when present on the row (today populated under `-v`). Without `-v`, those keys are absent. Always-present computed fields (`name`, `status`, and whatever `current`/`latest`/`repo_url` the algorithm already sets) remain.
- **Why:** Matches existing row construction; no second schema; `-v --json` is the enriched machine path.
- **Alternatives:** Always include empty strings — noisier, not truthful.

### 4. JSON I/O posture

- **Choice:** Success → `JSON.stringify(payload, null, 2)` on stdout; do not print `result.text`. Thrown / parse errors → stderr message (human), non-zero exit — same as today’s CLI catch path. Do not invent a parallel error-JSON object unless a future change needs it (deps why differs because why returns structured soft errors).
- **Why:** Outdated hard-fails are exceptions / parse errors today; keep simple.
- **Alternatives:** Always dual-emit text+JSON — rejected (criteria: JSON suppresses human table).

### 5. Core `parallelChecks` option

- **Choice:** Add `parallelChecks?: number` to `RunOutdatedOptions`. CLI default when flag omitted: pass `4`. Explicit `0` → serial path. Core treats `undefined` as `4` as well (defense in depth) so programmatic callers match APM default.
- **Why:** Same contract as `parallelDownloads` on install/update.
- **Alternatives:** Default serial in core and only CLI injects 4 — weaker APM alignment for library callers.

### 6. Concurrency implementation

- **Choice:** Extract per-dep check into an async worker; run with a small pool (same pattern as Resolver `runPool` / or map-limit into a results array by index). Local skips can be sync push or same worker path without network. After all settle, assemble `rows` in lock index order (never sort by completion time).
- **Why:** Matches APM `as_completed` + reorder; proves real overlap under stubs.
- **Alternatives:** `Promise.all` unbounded — violates `-j` bound. Fire-and-forget without index restore — breaks order MUST.

### 7. CLI parse forms

- **Choice:** Support `-j <n>`, `-j=<n>`, `--parallel-checks <n>`, `--parallel-checks=<n>`. Reject unknown flags. `--json` is long-only boolean. Reuse install/update integer validation (`Number`, finite, ≥ 0, `Math.floor`).
- **Why:** Criteria MUST + consistency with parallel-downloads.
- **Alternatives:** Only space-separated forms — weaker UX parity.

### 8. Do not touch P6e algorithm body beyond scheduling

- **Choice:** Move the existing per-dep logic into a function; do not change tip/`constraint`/infer-`^`/exit/read-only decisions inside that function.
- **Why:** Criteria MUST / MUST NOT; keeps acceptance focused on concurrency + JSON.

## Risks / Trade-offs

- [Flaky concurrency tests] → Inject delayed stubs; assert max in-flight ≤ n and at least one overlap for n≥2; use `parallelChecks: 0` in unrelated unit tests.
- [Race mutating shared ports] → Keep gitRemote/tagLister calls per-dep; no shared mutable check state beyond the results slot array.
- [JSON consumers expect APM `package`/`source`] → Document bapm-only shape; forbid inventing fields; help must not claim APM `--json`.
- [Default 4 surprises CI] → Tests that care about determinism pass `0` or stubs; production CLI matches APM.

## Migration Plan

1. Types + core pool + default `parallelChecks`.
2. CLI parse/help/wire `-j` / `--parallel-checks` / `--json`.
3. Acceptance/unit: parse, serial 0, bound+order, JSON shape, P6e green.
4. No lockfile / CONFORMANCE migration.

## Open Questions

- _(none)_ — JSON wrapper vs array and verbose field policy decided above.
