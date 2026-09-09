## 1. Dependency and ignore helper

- [ ] 1.1 Add `ignore` to the pnpm catalog and `@b-apm/core` dependencies via the pnpm-dependencies skill (no hand-edited version pins)
- [ ] 1.2 Implement Pack helper to load project-root `.bapmignore` (missing → empty rules; unreadable → fail closed) and match root-relative `/` paths with gitignore semantics (`#`, `!`, dir prune)
- [ ] 1.3 Export helper from Pack module / publicApi as needed for Registry reuse; unit-test match/negation/missing-file/unreadable cases

## 2. Pack collection

- [ ] 2.1 Wire `collectPackFiles` walk: after hard excludes, skip `.bapmignore`-matched paths (prune ignored dirs); always-include root `bapm.yml`/`apm.yml`; never emit `.bapmignore`; ignored secret paths must not secret-refuse
- [ ] 2.2 Add/extend Pack tests asserting zip membership for omitted README/CHANGELOG/`docs/**`, preserved manifest, and ignored `.env` success

## 3. Publish archive

- [ ] 3.1 Apply the same helper in `buildPublishArchive` for optional root docs and `.apm/**` walk; keep wire `apm.yml`; fail closed if `.apm/` has no remaining files after ignore
- [ ] 3.2 Add/extend Registry/publish tests for omitted README, preserved `apm.yml` + remaining `.apm` members, empty-`.apm` failure, and `--zip` bypass unchanged

## 4. Docs and help

- [ ] 4.1 Document `.bapmignore` in pack (and publish) reference/guide: syntax overview, examples (README/CHANGELOG), always-include/fail-closed notes, no `.gitignore` fallback
- [ ] 4.2 Mention `.bapmignore` in pack and/or publish `--help` text where file-set behavior is described

## 5. Verification

- [ ] 5.1 Run targeted Pack/Registry/publish tests for this change and fix regressions
- [ ] 5.2 Run `vp check` (or project-equivalent) for touched packages before handoff
