## Context

See `proposal.md` for motivation. Today `runOutdated` (`packages/core/.../Outdated/runOutdated.ts`): constraint → `tagLister` + `pickHighestSatisfyingTag`; else tip of `resolvedTipRef` (`resolved_ref` → manifest → `HEAD`) via `gitRemote.resolveRef`. Default `createDefaultTagLister` runs `git ls-remote --tags --refs`, which **omits peeled `^{}` lines**, so annotated vs lightweight cannot be distinguished. Default `createDefaultGitRemote.resolveRef` short-circuits exact 40-hex to itself — the SHA self-tip drift. Criteria: `.samples/apm-knowledge/topics/p7g-outdated-sha-tag-drift-criteria.md`. Lock emit already writes `resolved_ref` from classified literal ref (including full SHA) via `resolvedRefForEdge`.

## Goals / Non-Goals

**Goals:**

- Gate full-SHA `resolved_ref` onto an APM-aligned annotated-tag revision-pin check
- Extend tag transport so Outdated can require annotated evidence (fail-closed otherwise)
- Preserve P6e tip/constraint and p7b concurrency/JSON for all other pins
- Keep injectability for deterministic acceptance (stubs with explicit annotated flags)

**Non-Goals:**

- `update` / manifest SHA→`# tag` rewrite
- Changing default constraint `pickHighestSatisfyingTag` semantics for non–revision-pin paths
- CONFORMANCE / `--global` / marketplace / inventing `source` on rows

## Decisions

### 1. Gate = lock `resolved_ref` only, exact 40 hex

- **Choice:** `isFullRevisionPin(ref) = /^[a-fA-F0-9]{40}$/.test(ref)` on trimmed lock `resolved_ref`. Do **not** promote bare `resolved_commit` when `resolved_ref` is absent/empty into this path.
- **Why:** Matches APM `is_full_revision_pin(dep.resolved_ref)`. Empty `resolved_ref` keeps P6e manifest/`HEAD` tip behavior.
- **Alternatives:** Also gate on `resolved_commit` when ref missing — rejected (diverges from APM; would misclassify locks that only store commit hash).

### 2. Check order in `checkOneDep`

- **Choice:** (1) local skip → (2) if `constraint` → existing constraint path → (3) else if full-SHA `resolved_ref` → revision-pin path → (4) else existing tip-of-`resolved_ref` path.
- **Why:** APM checks revision pin before branch tip; constraint remains highest priority when present (spec scenario).
- **Alternatives:** Interleave SHA gate before constraint — rejected (constraint scenario requires constraint wins).

### 3. Annotated evidence via peel / optional `annotated` on tag records

- **Choice:** Extend tag listing used by the revision-pin path to surface annotated peel: default implementation lists tags **without** `--refs` (or equivalent), pairs `refs/tags/X` with `refs/tags/X^{}`, and only keeps tags that have a peel entry; commit = peeled SHA. Extend `FakeTag` (or revision-pin-specific list type) with `annotated?: boolean` so stubs can set evidence without real git. Constraint path MAY keep current `listTags` shape (annotated optional / ignored) so resolver semver resolve stays stable.
- **Why:** APM security fence; current `--refs` listing cannot implement MUST annotated-only.
- **Alternatives:** (a) Treat all `listTags` results as annotated — rejected (lightweight spoof). (b) Always fail-closed `unknown` until peel exists — safe but never greens real remotes; use only as fallback when peel parse yields zero annotated tags.

### 4. `findLatestAnnotatedTag` helper (Outdated or small shared util)

- **Choice:** Pure helper: filter `annotated === true` (or peel-proven), match APM patterns (`v{version}`, `{name}--v{version}`, `{name}-v{version}`, bare `{version}`), drop prereleases, pick max SemVer, return `{ tag, commit }`. Package `{name}` = basename of lock repo URL (strip `.git`); SHOULD: virtual `path:` basename when identity is path-shaped.
- **Why:** Mirrors APM `find_latest_annotated_tag` / `DEFAULT_TAG_PATTERNS`; keeps Outdated logic testable without network.
- **Alternatives:** Reuse `pickHighestSatisfyingTag` with invented `*` / `>=0.0.0` — weaker pattern/`{name}` parity; prefer dedicated matcher.

### 5. Compare + display

- **Choice:** Case-insensitive equality of pin SHA vs tag commit → status. SHOULD display: `current` abbreviated to 8 hex; `latest` as `` `${tag} (${shortsha})` ``; `tip_ref` = chosen tag; verbose `detail` includes `revision-pin` + tag. Do not add `source`.
- **Why:** Criteria MUST compare + SHOULD display; row schema stays bapm `OutdatedRow`.
- **Alternatives:** Keep full 40-hex in `current`/`latest` — acceptable if display SHOULD slips, but prefer APM-like strings in apply when cheap.

### 6. Default TagLister vs Outdated-specific listing

- **Choice:** Prefer extending Resolver `TagLister`/`FakeTag` with optional annotated metadata **and** a default revision-pin-capable list (peel-aware), used by Outdated revision path; constraint/outdated-semver path can ignore `annotated`. If changing global default `listTags` risks resolver regressions, add `listAnnotatedTags` (or options flag) on the port / Outdated options instead of changing `--refs` behavior for resolve.
- **Why:** Isolate risk to outdated SHA path; resolver continues to see lightweight+annotated tag names as today.
- **Alternatives:** Always change `createDefaultTagLister` to peel-aware — possible but needs resolver regression scrutiny; document as apply-time choice with tests.

### 7. No CLI flag / no update rewrite

- **Choice:** No new argv. Help text only if outdated help already discusses pin kinds — then mention SHA→annotated-tag for **outdated** only.
- **Why:** Scope = reporting; update rewrite is explicit non-goal.

## Risks / Trade-offs

- [Default `--refs` TagLister cannot see peel] → Peel-aware listing on revision-pin path; stubs set `annotated`; fail-closed `unknown` if evidence missing.
- [Peel-aware ls-remote noisier / slower] → Tags-only (`ls-remote --tags` without `--refs`); SHOULD S4; still bounded by existing `parallelChecks`.
- [Pattern/`{name}` mismatch vs APM edge tags] → Follow APM pattern list; acceptance covers `v*` + bare; name-prefixed as SHOULD.
- [Locks with SHA only in `resolved_commit`] → Stay on tip/`HEAD` path (documented); operators re-lock or set `resolved_ref` for APM parity.
- [Constraint + SHA `resolved_ref`] → Constraint wins (decision 2); document in acceptance.

## Migration Plan

1. Types/helper: `isFullRevisionPin` + `findLatestAnnotatedTag` (+ optional FakeTag.annotated / peel lister).
2. Wire `checkOneDep` revision-pin branch; display SHOULD.
3. Unit tests with stubs (annotated fence, statuses, abbreviated non-entry).
4. Acceptance suite (RED→GREEN via orchestrate); P6e/p7b regressions.
5. No lockfile format migration; dual-read APM locks with SHA `resolved_ref` benefit immediately.

## Open Questions

- Whether peel-aware listing lands as `TagLister.listTags` option vs a sibling method — choose in apply based on Resolver regression cost; behavior contract is fixed by the delta spec either way.
