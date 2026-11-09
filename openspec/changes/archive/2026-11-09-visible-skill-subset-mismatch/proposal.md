## Why

A consumer `skills:` subset whose names are missing from the package currently deploys nothing (or silently drops leftover names) with install exit 0 and no CLI warning. Core already pushes `EMPTY_SKILL_SUBSET` for a total miss, but the CLI warning emitter never prints it, and a partial miss skips the diagnostic entirely. That is a silent skill-loss path (typo, vendor rename, prune) and a hole in req-mf-022.

## What Changes

- Install emits a default-visible warning whenever a non-empty `skills:` subset contains names that match no available skill of that dependency — both the all-unknown case and leftover unknown names next to matches.
- The CLI prints those diagnostics as `bapm: warning:` on stderr. Install still succeeds (req-mf-022: warn, not fail-closed).
- Core diagnostic objects carry `warn: true` plus requested / unmatched / available names so CLI and tests can inspect them.

Non-goals:

- Fail-closed install or a `--allow-missing-skills` flag (plugin.json exclusive `skills:` stays fail-closed; consumer subset stays warn).
- First-class lock field (`skills_requested`) and a new `bapm audit` check for subset drift — deferred, same as the original subset slice.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `deps-object-subset`: unmatched names in a consumer `skills:` subset MUST produce a default-visible install warning even when some names still match; the CLI MUST print it.

## Impact

- `packages/core/src/modules/Install/runInstall.ts` (`applySkillSubsets`)
- `packages/cli/src/modules/Install/services/runInstall.ts` (warning emitter)
- Tests in `packages/core/tests/install` and `packages/cli/tests/install`
- User docs for dependency `skills:` subsets
