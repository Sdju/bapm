## Context

See `proposal.md` for motivation. Post-P6f, `whyDeps` uses `findExactMatches` (exact `name` **or** exact `repo_url` only); ambiguous path already emits `matches: { name?, repo_url? }[]` with exits `0/1/2` and `--json` stdout/stderr wiring. `deps clean` → `cacheClean({ yes })` with refuse-without-yes; no dry-run. Criteria: `.samples/apm-knowledge/topics/p7c-deps-why-basename-criteria.md`; deep-dive: `command-deep-dive-deps.md`. APM reference: `resolve_package_query` order unique key → exact `repo_url` → unique `owner/repo` → unique basename; multi-match → ambiguous with `repo_url` list.

## Goals / Non-Goals

**Goals:**

- Staged query resolve: exact → unique owner/repo → unique basename; ambiguous never arbitrary
- Preserve P6f exit codes, success JSON, error JSON streams, and `matches` object identity shape
- Ship thin `deps clean --dry-run` via `cacheClean({ dryRun })`
- Help + fail-closed flags

**Non-Goals:**

- Switching `matches` to APM bare `string[]` of `repo_url`
- `--global`; CONFORMANCE churn; shared git/http cache; `deps info`; human `+--` ASCII polish
- Interactive wipe confirm

## Decisions

### 1. `matches` JSON shape: keep P6f objects (not APM string[])

- **Choice:** Ambiguous `--json` stderr stays:

```json
{
  "error": "ambiguous",
  "query": "<q>",
  "matches": [{ "name": "…", "repo_url": "…" }, { "repo_url": "…" }]
}
```

- Each element is `{ name?: string, repo_url?: string }`. **Include `repo_url` whenever the lock entry has it**; include `name` when present. Omit absent optionals (do not emit `null` placeholders). Deterministic order: lock dependency order (first-seen), de-duped by package key (`name ?? repo_url`).
- **Why:** Criteria allow either shape if identities disambiguate; keeping objects **preserves P6f JSON** and bapm name-keyed locks. APM's `repo_url[]` would be a silent BREAKING change for existing tests/consumers.
- **Alternatives considered:** Bare `repo_url[]` like APM — rejected (weakens P6f; loses name when `repo_url` missing). Dual-emit both shapes — rejected (noise).

### 2. Resolve precedence (staged forms)

- **Choice:** Evaluate forms in order; stop at the first form that yields ≥1 match:

  1. **Exact:** lock `name === query` **or** lock `repo_url === query` (current P6f `findExactMatches`)
  2. **Owner/repo:** derive from each lock `repo_url` → last two path segments; strip trailing `.git` on the repo segment; if &lt;2 segments, identity = full `repo_url` string; compare to query
  3. **Basename:** derive last path segment of `repo_url`; strip trailing `.git`; compare to query
  - 1 match at active form → success (same walk/`package`+`paths` as today)
  - ≥2 matches at active form → `ambiguous` exit `1` (**do not** fall through)
  - 0 matches → try next form; after all forms → `not_installed` exit `1`

- **Why:** Criteria MUST #6 — exact never loses to basename collision; mirrors APM `resolve_package_query` stages adapted for bapm's exact-name floor.
- **Alternatives:** Union all forms then pick — rejected (creates false ambiguous / wrong pick). Basename before owner/repo — rejected (APM order; owner/repo is more specific).

### 3. URL parsing helpers (local, pure)

- **Choice:** Small pure helpers in Deps (e.g. `repoBasename`, `repoOwnerRepo`) operating on `repo_url` strings: trim, strip trailing `/`, take path segments from URL pathname when parseable, else split on `/`. Strip a single trailing `.git` on the final segment only. No network; empty/`repo_url` absent → skip that package for short forms.
- **Why:** APM `_basename` / `_owner_repo` parity without pulling git helpers.
- **Alternatives:** Match against lock `name` for basename — rejected (criteria: derive from `repo_url` only for short forms; exact name already covered).

### 4. Include `--dry-run` in this change (not DEFER)

- **Choice:** Ship SHOULD dry-run now. Extend `CacheCleanOptions` with `dryRun?: boolean`. When `dryRun`:

  - Skip `requireYes` refuse path
  - If root absent → `ok: true`, `cleaned: false`, `removedEntries: 0`, message already-clean / would remove 0
  - If present → list entry names (filter `.`/`..`), set `removedEntries` = count (or add `wouldRemoveEntries` / `wouldRemoveNames` if clearer — prefer reusing `removedEntries` as “would remove” count under dry-run and keep `cleaned: false`), **do not** `rm`
  - Message prefix MAY say `deps clean` / `cache clean` dry-run

  CLI: `parseDepsArgs` accepts `--dry-run` only on `clean`; call `cacheClean({ cwd, dryRun: true })`. Wire `cache clean --dry-run` for symmetry if parse path is one-liner; not a DoD blocker if deps path works.

- **Why:** Criteria “include if thin”; one core path; APM dry-run before confirm.
- **Alternatives:** DEFER dry-run — rejected (thin + avoids follow-up slice). Separate Deps-only preview without Cache — rejected (duplication).

### 5. Preserve P6f success / error JSON and exits

- **Choice:** No changes to success `{ package, paths }`, error discriminators `no_lockfile` | `not_installed` | `ambiguous`, stream routing (success stdout / errors stderr with `--json`), or exit `0/1/2`. Human text for ambiguous SHOULD list identities (existing join style OK).
- **Why:** Criteria MUST NOT weaken P6f.
- **Alternatives:** New error code for short-form — rejected.

### 6. CLI help surface

- **Choice:** Update `formatDepsHelp`: why examples for basename / `owner/repo`; document `clean --dry-run`. Keep fail-closed for unknown flags and for `--dry-run` / `--json` on wrong subcommands.
- **Why:** Criteria MUST #7 + SHOULD help honesty.

## Risks / Trade-offs

- [Basename collides with lock `name` of another package] → Staged exact-first precedence; acceptance covers exact-wins scenario.
- [Weird `repo_url` / `local:` paths] → Segment helpers best-effort; &lt;2 segments fall back; empty URL skipped for short forms.
- [Consumers assumed APM `matches: string[]`] → Document bapm object shape in design/help; acceptance asserts objects with `repo_url` when known.
- [Dry-run message wording differs cache vs deps] → CLI may rewrite `cache clean` → `deps clean` prefix as today; semantics identical.

## Migration Plan

1. Core why: helpers + staged resolve; unit tests for unique/ambiguous/`.git`/precedence.
2. Core cache: `dryRun` option; no-delete guarantee.
3. CLI: help + `--dry-run` on clean; optional cache CLI flag.
4. Acceptance RED→GREEN for MUST + dry-run SHOULD; P6f regressions green.
5. No CONFORMANCE / roadmap claim edits in apply (roadmap **done** only after archive).

## Open Questions

- _(none)_ — `matches` shape and dry-run inclusion decided above. `cache clean --dry-run` CLI wiring is optional symmetry, not a spec blocker if core+deps ship.
