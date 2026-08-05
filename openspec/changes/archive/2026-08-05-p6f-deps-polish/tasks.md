## 1. Core why result + query

- [x] 1.1 Extend `DepsWhyResult` / related types with structured `package`, `paths` (or equivalent), optional `error` discriminator, and honest `ok` / `exitCode`
- [x] 1.2 Rewrite `whyDeps` to: load lock → fail `no_lockfile` exit `2` if missing/unreadable; resolve query by exact `name` **or** exact `repo_url`; zero matches → `not_installed` exit `1`; multi-match → `ambiguous` exit `1`; success → build deterministic paths + package meta (`version` tag/ref/commit fallback, `source`, `is_direct`)
- [x] 1.3 Keep human `text` / `chains` for non-JSON callers; never return exit `0` for empty/missing target
- [x] 1.4 Unit-test: name match, repo_url match, missing package, no lock, transitive parent chain, offline-only

## 2. CLI why --json + exits

- [x] 2.1 `parseDepsArgs`: accept `--json` on `why` only; `--json` on list/tree/clean → fail-closed; keep unknown-flag fail-closed
- [x] 2.2 Wire `runDepsCli` why path: with `--json`, success → stdout JSON (`package`+`paths`); failure → stderr JSON `{error:...}`; map core `exitCode` (`0/1/2`)
- [x] 2.3 Human why path: print `text`; use honest exits (no always-0)
- [x] 2.4 Update `formatDepsHelp` for `why --json`

## 3. deps clean alias

- [x] 3.1 Accept subcommand `clean` with `-y` / `--yes` in parse/run
- [x] 3.2 Call existing `cacheClean({ cwd, yes })` (CLI imports Cache helper; no duplicated wipe)
- [x] 3.3 Help: document `deps clean` ≡ modules wipe / `cache clean` (not shared APM git/http cache)
- [x] 3.4 SHOULD if cheap: `--dry-run` listing would-remove; otherwise skip without blocking DoD

## 4. Acceptance + hygiene

- [x] 4.1 Acceptance: why `--json` success keys stable; transitive chain includes parent
- [x] 4.2 Acceptance: missing package exit `1` (+ JSON `not_installed` on stderr); no lock exit `2` (+ JSON `no_lockfile`)
- [x] 4.3 Acceptance: query by `repo_url` and by `name`; human why still prints chains on success
- [x] 4.4 Acceptance: `deps clean -y` removes `apm_modules` equivalently to `cache clean -y`; without `-y` refuses; list/tree regression green
- [x] 4.5 No CONFORMANCE claim-table edits; knowledge/roadmap note P6f only if already in-flight elsewhere (do not invent unrelated docs)
