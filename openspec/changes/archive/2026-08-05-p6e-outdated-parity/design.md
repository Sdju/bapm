## Context

See `proposal.md` for motivation. Today `runOutdated` uses `constraint` or `inferConstraintFromTag(resolved_tag)` → tag path, else `gitRemote.resolveRef(url, "HEAD")`. Resolver `buildLockDocument` writes `constraint` / `resolved_tag` / `resolved_commit` but drops the classified ref name; Lockfile serialize already lists `resolved_ref` in key order and round-trips unknowns. APM stores pin identity in `LockedDependency.resolved_ref` and outdated tips that ref. Criteria: `.samples/apm-knowledge/topics/p6e-outdated-parity-criteria.md`.

## Goals / Non-Goals

**Goals:**
- Emit and consume `resolved_ref` end-to-end (resolve → lock → outdated)
- Correct tip check for branch/literal pins; remove false `^` inference
- Thin CLI `-v`; keep exit 0 / read-only contracts
- Reuse existing `gitRemote` / `tagLister` injectables

**Non-Goals:**
- New shared git cache; `--global`; marketplace/registry outdated; full revision-pin annotated-tag suite
- Update CLI polish; CONFORMANCE claim edits; changing exit semantics

## Decisions

### 1. `resolved_ref` always written for git pins
- **Choice:** On lock emit for git-literal and git-semver, set `resolved_ref` from resolver node pin identity. Semver: `resolved_ref === resolved_tag` when tag known. Literal: classified `ref` or `"HEAD"`.
- **Why:** Matches APM lock shape; enables lock-only outdated without re-parsing manifest for the common path.
- **Alternatives:** Manifest-only tip identity — rejected (breaks lock-only / APM dual-read locks that already have the field).

### 2. Carry classified ref on `ResolvedNode`
- **Choice:** Ensure `resolveGraph` / node type retains `ref` (or `resolved_ref`) through to `buildLockDocument` instead of dropping after `resolveRef`.
- **Why:** Minimal surface; avoid re-deriving from manifest at serialize time.
- **Alternatives:** Re-classify from manifest at lock write — more brittle for warm/update paths.

### 3. Outdated tip resolution order
- **Choice:** (1) lock `resolved_ref` if non-empty → (2) manifest pin for same identity → (3) `"HEAD"` last resort. Never invent constraint from tag.
- **Why:** Criteria MUST; dual-read APM locks with field work immediately; older bapm locks without field still get correct tip via manifest when present.
- **Alternatives:** Always require lock field only — rejected (breaks pre-P6e locks until re-lock).

### 4. Remove / gate `inferConstraintFromTag`
- **Choice:** Delete or never call on the outdated path; constraint path only when lock `constraint` is a string.
- **Why:** Invented `^` is a correctness bug, not a feature.
- **Alternatives:** Gate behind verbose-only heuristic — rejected.

### 5. Verbose as CLI option + core detail hook
- **Choice:** CLI parses `-v`/`--verbose` and passes a flag into core; core MAY attach extra lines (chosen tip, skip reason, candidate tags) to result text without changing default row schema used by tests.
- **Why:** Thin UX; keeps domain testable without argv.
- **Alternatives:** CLI-only decoration without core knowledge — weaker for unit tests.

### 6. SHOULD flags deferred unless cheap
- **Choice:** `--parallel-checks`/`-j` and `--json` are optional in the same change if wiring is cheap with existing ports; otherwise leave follow-up. Tests MUST stay deterministic (serial or injected stubs).
- **Why:** Criteria SHOULD, not DoD blockers.

### 7. First-class `resolved_ref` on LockedDependency
- **Choice:** Type the field on the lock dependency model (already in serialize key order); preserve APM-written values on round-trip.
- **Why:** Spec + emit path need a real field, not only unknown bag.

## Risks / Trade-offs

- [Older locks without `resolved_ref`] → Manifest fallback + document `HEAD` last resort; acceptance covers both.
- [Golden lock fixtures gain `resolved_ref`] → Update fixtures/tests, not OpenAPM normative claims.
- [Parallel checks non-determinism] → Default serial in tests; inject stubs; only ship `-j` if cheap.
- [Dual-read APM locks] → Prefer consuming present `resolved_ref` verbatim (no rewrite unless resolve runs).

## Migration Plan

1. Types + Resolver emit `resolved_ref` on new lock writes.
2. Outdated algorithm + remove `inferConstraintFromTag` use.
3. CLI `-v` + help.
4. Acceptance: branch tip, semver, no-`^`, missing lock, read-only, lock field round-trip.
5. Re-lock existing projects optionally to populate field (not required for outdated if manifest fallback works).

## Open Questions

- Ship `--json` / `-j` in this change only if apply finds them trivial; otherwise defer without changing MUST specs.
