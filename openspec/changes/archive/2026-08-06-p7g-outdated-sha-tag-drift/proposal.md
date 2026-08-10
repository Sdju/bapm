## Why

After P6e (tip-of-`resolved_ref`) and p7b (`-j` / `--json`), full-SHA lock pins still drift from APM: bapm treats `resolved_ref` as a tip identity, so a 40-hex SHA self-resolves and often stays forever **up-to-date**. APM `outdated` instead compares that pin to the commit behind the **latest annotated semver tag**. Operators cannot trust SHA-pin drift reports until this path matches.

## What Changes

- Detect full revision pins: lock `resolved_ref` matching exactly `/^[a-fA-F0-9]{40}$/` (abbreviated SHAs stay on the existing tip path).
- For that path only: resolve “latest” via **highest non-prerelease annotated semver tag** (APM-style patterns + basename rules, or documented equivalent), compare pin SHA ↔ tag commit (case-insensitive) → `outdated` / `up-to-date`; no candidate → `unknown`.
- Reject lightweight tags and branches as SHA-pin targets (fail-closed toward `unknown` when annotated evidence is missing).
- Keep P6e tip/`constraint`/`-v` and p7b `-j`/`--json` unchanged for non–full-SHA pins; outdated remains read-only; exit `0` with outdated rows; missing lock → non-zero.
- SHOULD (in scope if cheap): `latest` display like `tag (shortsha)`; verbose `detail` naming revision-pin + chosen tag; tags-only listing for this path.

**Non-goals:** `apm update` / bapm `update` SHA→`# tag` manifest rewrite; `--global`; marketplace/registry outdated; inventing APM-only row keys (`source`); CONFORMANCE claim-table edits; changing abbreviated-SHA / branch / constraint semantics.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `lifecycle-outdated`: full-SHA `resolved_ref` uses annotated-tag revision-pin check instead of tip-of-that-SHA; statuses and fences as above; other pin kinds unchanged.

## Impact

- `@b-apm/core` Outdated: gate + revision-pin check; likely extend tag-list transport / `FakeTag` (or Outdated-local port) with annotated peel evidence; semver pattern helper for annotated-only max pick.
- `bapm` CLI: no new flags expected; help/docs only if they mention SHA pins — stay truthful (outdated reporting, not update rewrite).
- Tests: acceptance for SHA drift / match / no-candidate / lightweight fence / abbreviated-SHA non-entry; P6e/p7b regressions green.
- Knowledge criteria: `.samples/apm-knowledge/topics/p7g-outdated-sha-tag-drift-criteria.md` (gitignored; not committed with this change).
