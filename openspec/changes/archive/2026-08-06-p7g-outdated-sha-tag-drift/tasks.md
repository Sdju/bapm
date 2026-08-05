## 1. Tag transport + helpers

- [x] 1.1 Extend tag record / TagLister (or Outdated-local peel lister) so revision-pin path can require annotated evidence (`annotated` flag and/or peeled `^{}` parse); keep constraint/`listTags` resolve path behavior stable unless covered by regressions
- [x] 1.2 Add peel-aware default listing for the revision-pin path (`git ls-remote --tags` without `--refs`, pair peel commits; lightweight without peel → not annotated)
- [x] 1.3 Implement `isFullRevisionPin` (exact 40 hex) and `findLatestAnnotatedTag` (annotated-only, APM patterns, drop prerelease, max SemVer → `{ tag, commit }`)
- [x] 1.4 Unit-test helpers: pattern pick, prerelease drop, lightweight excluded, empty → no candidate

## 2. Outdated revision-pin path

- [x] 2.1 In `checkOneDep`, after local skip and constraint path: if `resolved_ref` is full SHA → revision-pin check (not tip-of-SHA); else existing tip path
- [x] 2.2 Compare pin SHA ↔ tag commit (case-insensitive) → `outdated` / `up-to-date`; no candidate / no annotated evidence → `unknown`
- [x] 2.3 SHOULD display: abbreviate `current` (8 hex); `latest` as `tag (shortsha)`; verbose `detail` / `tip_ref` name revision-pin + chosen tag (no `source` field)
- [x] 2.4 Core unit tests with stubs: newer annotated → outdated; match → up-to-date; no candidate → unknown; lightweight spoof → unknown; abbreviated SHA stays tip path; constraint still wins when present

## 3. CLI / docs truthfulness

- [x] 3.1 No new flags; if outdated help mentions pin kinds, document SHA→annotated-tag for **outdated** only (not update rewrite)
- [x] 3.2 Confirm `-j` / `--json` / `-v` / exit / read-only unchanged (smoke or existing suite)

## 4. Acceptance + regressions

- [x] 4.1 Acceptance (orchestrate RED→GREEN): full-SHA + newer annotated → outdated; pin equals tag commit → up-to-date; no annotated → unknown; lightweight fence; abbreviated SHA / branch / constraint regressions
- [x] 4.2 Run P6e tip/constraint and p7b parallel/JSON suites; fix only regressions caused by this change
- [x] 4.3 `openspec validate p7g-outdated-sha-tag-drift --strict` remains green; no CONFORMANCE claim edits; no update SHA→`#tag` rewrite
