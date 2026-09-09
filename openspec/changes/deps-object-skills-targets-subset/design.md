## Context

See `proposal.md` for motivation. Today `packages/core` Manifest `validateApmEntry` allowlists `skills` / `targets` in `DEP_META_KEYS` and spreads them onto `ObjectDependency` as `skills?: unknown` with **no** list validation. `classifyDependencyRef` and `ResolvedNode` drop those fields. Install intersection reads **package** top-level `target`/`targets` from the dependency's own manifest (`declaredTargetIds`), not consumer-side per-entry subsets. `serializeManifest` YAML-dumps the in-memory document (so authored `id:` objects survive if never rewritten), but `packageRefToEntry` turns CLI shorthands into git strings, and there is no guard against replacing an `id:` row with `{ git: … }`.

Git-longhand subset is **not** already consumed; this slice implements one shared helper used by `git:` and `id:`.

APM analog: microsoft/apm #2166 (`parse_registry_object_entry` + `to_apm_yml_entry` registry dict + `propagate_existing_registry_source` / refuse git-shaped merge). Shared parsers: `parse_skill_subset` / `parse_target_subset` (empty list fail, traversal fail, unknown target fail, dedupe/sort).

Specs: `deps-object-subset` plus deltas on `manifest-yaml-validate`, `dependency-resolve`, `install-pipeline`, `openapm-conformance-statement`.

## Goals / Non-Goals

**Goals:**

- One parse helper for `skills` / `targets` on object-form APM deps; typed `string[]` on `ObjectDependency`.
- Carry subsets on classify + resolved nodes; filter at materialize only.
- Preserve `id:` object-form on serialize and structured merge (req-mf-024).
- Docs + Mode B claim for mf-024; honest mf-022 citation.

**Non-Goals:**

- CLI `--skill` / `--skill '*'` (follow later if needed; YAML field is enough for this slice).
- Adding `kiro` / `grok-build` to `CANONICAL_TARGET_TOKENS` (does not block: subset tests use existing tokens).
- Fetch-time sparse checkout; lock schema `skill_subset` as a new first-class audit field (open index may retain extras; not required).
- Exclusive plugin.json `skills:` declaration; `--trust-bin`; path-form #1987 as a success criterion.

## Decisions

### Shared subset parser in Manifest, reused by git and id

**Choice:** Add a small Manifest helper (e.g. `parseDepSkillSubset` / `parseDepTargetSubset`) called from `validateApmEntry` for any object-form entry that sets those keys. Git `git:` and registry `id:` share it. `targets` tokens use existing `isValidTargetToken` (canonical + alias + vendor), not a new catalog.

**Why:** APM #2166 is “align registry with git”; bapm has no git consumption yet, so one helper is the analog. mf-005 expansion is not required to validate `cursor` / `claude` / vendor ids.

**Alternatives:** Validate only when `id` is present — rejected (git-longhand would stay silently ignored). Expand `CANONICAL_TARGET_TOKENS` for kiro/grok-build — out of scope; `targets: [kiro]` stays invalid until identity slice.

### Subset is materialize-time, not resolve-time

**Choice:** Full package still downloads into modules. `ClassifiedDependency` / `ResolvedNode` gain optional `skillSubset` / `targetSubset` copied from the declaring object. Install filters discovered primitives after existing discover + package-declared intersection.

**Why:** Matches APM (clone whole tree, then `skill_subset` / `target_subset` in integrate). Sparse fetch would change lock `tree_sha256` and cache identity.

**Alternatives:** Re-read root manifest at install by identity only — rejected (transitive object-form subsets and graph nodes would drift). Filter inside `discoverPrimitives` — keep discover complete; filter in Install so dry-run/diagnostics still see available names for mf-022.

### Two different `targets:` fields

**Choice:** Package-level top-level `targets` (already used for intersection) stays. New consumer per-entry `targets:` is an extra conjunct: deploy iff active ∈ (packageDeclared ∪ unconstrained) ∩ perDepSubset ∩ consumerAuth. Do not overload `declaredTargetIds` of the **package** manifest with the **consumer** entry list.

**Why:** APM docs: package `targets:` vs per-dep `targets:` compose via intersection. Existing `target-wire.test.ts` scenarios must remain about the package's own manifest.

### Skill name matching

**Choice:** Match skill primitive `name` first; also accept a documented relative skill path alias when the primitive carries `skillDirectory` / plugin path (APM: `skills/productivity/grill-me`). Deduplicate and sort lists at parse (stable YAML). Traversal / absolute names fail at parse, not at install.

**Why:** Fail-closed at the boundary APM uses; install then only compares normalized names.

### req-mf-024 guard on structured merge, not only stringify

**Choice:** Keep `serializeManifest` as YAML dump of the in-memory object (authored `id:` already round-trips). Add an identity-aware merge helper used by package-ref / install write-back: if existing entry `source` is registry (`id` or `registry` without converting to git), refuse git-shaped replacements; allow registry-shaped updates that add `skills`/`targets`. When matching identities, treat `id: owner/repo` and string `owner/repo` as the same identity so `bapm install owner/repo` does not append a git-string sibling beside an `id:` row.

**Why:** APM's bug was `to_apm_yml_entry` emitting git dicts; bapm's analogue is merge/package-ref, not yaml.stringify. Duplicate string + object rows would also lose registry identity in practice.

**Alternatives:** Rewrite `packageRefToEntry` to always emit `{ id }` when a default registry exists — larger registry-routing change; defer unless merge tests require it. For this slice, identity match + refuse conversion is the bar.

### mf-022 is warn, not fail

**Choice:** Zero matches for a persisted skill subset → diagnostic (install result `diagnostics`), overall `ok` unless another gate fails.

**Why:** OpenAPM req-mf-022 explicitly allows success with a visible diagnostic so stale pins are not hard errors.

### CLI `--skill` deferred

**Choice:** Do not add the flag in this slice. YAML `skills:` is the user-visible subset. Any later flag MUST call the mf-024 merge helper.

**Why:** Parent slice is #2166 YAML + serialize; `--skill` is the older skill-bundle CLI (#974) and is easy to bolt onto the merge helper later.

## Risks / Trade-offs

- **[Authors expect `targets: [kiro]` on a dep]** → Document current token set; identity slice later. Tests use `cursor` / `copilot` / vendor ids.
- **[Confusion with package-level `targets:`]** → Docs table: top-level vs per-entry; specs name “per-dep” vs “package-declared”.
- **[Transitive deps with subsets]** → Carry subset only on the declaring edge (the consumer entry). Child manifests' own `dependencies.apm` subsets apply when those children are object-form entries in some manifest, not magically inherited.
- **[Plugin exclusive `skills:` later]** → This slice filters by consumer list only; do not teach Install to read plugin.json `skills` as exclusive (follow-up).

## Migration Plan

1. Acceptance RED: parse fail-closed; registry + git subset materialize; YAML round-trip `id:`; refuse git-shaped merge; mf-022 diagnostic.
2. Apply: Manifest helper → classify/ResolvedNode → Install filter + merge guard → docs + `conformance:gen`.
3. Rollback = revert; manifests without `skills`/`targets` unchanged.

## Open Questions

_None._ Lock `skill_subset` first-class field can wait; unknown-key retention is enough if apply wants to copy lists onto lock rows.
