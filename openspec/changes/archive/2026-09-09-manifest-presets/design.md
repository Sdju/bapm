## Context

Today `@b-apm/core` Manifest parse treats `active` as `string[]` of mf-005 host tokens (`parseActiveField`), overlay replace-merges that list, and install/compile host selection reads `manifestActive` as host ids. Dependency resolve reads root `dependencies` / `devDependencies` only. See proposal.md for why presets land now and that legacy list `active` may be redefined without migration.

## Goals / Non-Goals

**Goals:**

- Single structured `ActiveSelection` model shared by base parse, overlay validate, nested preset `active`, and host/preset resolvers.
- Pure expansion: `resolveActive(doc) → { presetIds, targetIds }` with cycle detection; `effectiveDirectDeps(doc, presetIds) → deps maps`.
- Wire expansion into resolve/lock/install before graph classify; wire `targetIds` into existing host selection (force still wins).
- Keep overlay allowlist unchanged except validating new `active` shapes; reject `presets` on overlay.

**Non-Goals:**

- No dual-parse of legacy `active: [cursor]`.
- No overlay-defined presets or remote preset catalogs.
- No change to `target`/`targets` object-map dynamic load or `local:` source discrimination.
- No install-pipeline delta unless apply finds narrative examples that assert bare-list parse (fixtures/docs only).

## Decisions

### 1. Canonical in-memory shape

Normalize every accepted YAML form into:

```ts
type ActiveEntry = { kind: "preset" | "target"; id: string; negate: boolean };
// document.active: ActiveEntry[] (declaration order preserved)
```

Object form flattens `preset`/`target` scalars-or-arrays into ordered entries (presets first, then targets, within each key array order). List-of-maps form keeps YAML order.

**Alternatives:** Keep separate object AST — rejected; harder for overlay replace equality and cycle walks.

### 2. Expansion algorithm

1. Walk top-level `active` entries; maintain `includedPresets`, `excludedPresets`, `includedTargets`, `excludedTargets`, and a DFS stack for preset names.
2. On include preset: fail if unknown; fail if name on stack (cycle); push stack; union that preset’s dependency contribution later; if preset has nested `active`, recurse; pop stack.
3. On negate preset/target: record exclude set.
4. Final sets: includes minus excludes (excludes win).
5. Host path uses final `targetIds` only; resolve path unions deps from final `presetIds`.

**Alternatives:** Soft-warn on cycles — rejected (fail closed per product).

### 3. Dependency union conflicts

Same direct name in base vs included preset (or across two included presets) with unequal constraint/source → `MANIFEST_PRESET_DEP_CONFLICT` (or resolve-time equivalent) fail closed. Equal declarations are idempotent.

**Alternatives:** Last-wins — rejected for reproducibility.

### 4. Breaking parse + call-site updates

Replace `active?: string[]` on the document type with `active?: ActiveEntry[]` (or a small branded type). Update CLI init emit, help examples, core/cli tests, and docs samples from bare lists to `{ target: … }`. Specs that only care about “resolved host ids” keep behavioral meaning; YAML fixtures must use structured form.

### 5. Module placement (FEOD)

- Parse/validate: `Manifest` module (extend parse + types).
- Expansion + dep union: small pure helpers under `Manifest` (or `Install`/`Resolve` consumer calling Manifest API) so resolve and install share one path.
- Overlay merge: continue whole-field replace of normalized `active`.

## Risks / Trade-offs

- [Risk] Wide fixture churn from BREAKING `active` → Mitigation: mechanical rewrite to `{ target: id }`; grep `active:` in tests/docs during apply.
- [Risk] Authors confuse preset names with host ids → Mitigation: never pass preset ids to integration registry; diagnostics distinguish `preset` vs `target`.
- [Risk] Nested `active` complexity → Mitigation: cycle detection + docs example for “team wraps developer”; keep v1 presets list-shaped only.
- [Trade-off] Overlay replace (not deep-merge) of `active` means local must restate full selection — consistent with today’s list replace; document negation for in-document overrides, not cross-layer merge.

## Migration Plan

1. Land parse BREAKING + expander + resolve union + host selection on `targetIds`.
2. Update init/help/docs/tests in the same change.
3. No on-disk lock migration; no dual-read of legacy `active`.
4. Rollback = revert change; projects that already wrote structured `active` would need to revert YAML (acceptable: unused in prod).

## Open Questions

None that block specs or tasks; conflict error code naming can follow existing `ManifestError` conventions at apply time.
