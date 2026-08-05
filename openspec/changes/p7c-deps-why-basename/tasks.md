## 1. Core why short-form resolve

- [x] 1.1 Add pure helpers for `repo_url` basename and `owner/repo` (path segments; strip trailing `.git` on final segment; &lt;2 segments fallback per design)
- [x] 1.2 Replace exact-only match with staged resolve: exact `name`|`repo_url` → unique owner/repo → unique basename; ≥2 at active form → `ambiguous`; 0 after all → `not_installed`
- [x] 1.3 Keep P6f `matches` as `{ name?, repo_url? }[]` (prefer `repo_url` when known); preserve exits `0/1/2` and success `package`+`paths`
- [x] 1.4 Unit-test: unique basename; unique owner/repo; ambiguous basename; `.git` strip; exact wins over basename collision; P6f name/url + no-lock regressions

## 2. Core cache dry-run

- [x] 2.1 Extend `CacheCleanOptions` with `dryRun?: boolean`; when set, skip yes-refuse, list would-remove, never delete; absent root → ok / would-remove 0
- [x] 2.2 Unit-test: dry-run leaves entries; dry-run without yes succeeds; absent root dry-run ok

## 3. CLI deps surface

- [x] 3.1 `parseDepsArgs`: accept `--dry-run` on `clean` only; fail-closed on other subs; keep why `--json` wiring unchanged
- [x] 3.2 Wire `deps clean --dry-run` → `cacheClean({ cwd, dryRun: true })`; rewrite message prefix `cache clean` → `deps clean` as today
- [x] 3.3 Update `formatDepsHelp`: basename / `owner/repo` why examples; document `clean --dry-run`
- [x] 3.4 Optional: wire `cache clean --dry-run` for symmetry if parse path is trivial (not DoD blocker)

## 4. Acceptance + hygiene

- [x] 4.1 Acceptance: unique basename explains package (human + `--json`); unique owner/repo explains package
- [x] 4.2 Acceptance: ambiguous basename → exit `1`, JSON stderr `error: ambiguous` + `matches` objects with identity
- [x] 4.3 Acceptance: `.git` strip; exact name/url + `--json` + exits `0/1/2` P6f regressions green
- [x] 4.4 Acceptance: `deps clean --dry-run` no delete / no `-y`; absent modules already clean; refuse-without-`-y` for real wipe still holds
- [x] 4.5 No CONFORMANCE claim-table edits; no `--global`; help fail-closed for unknown flags
