## 1. Manifest schema and types

- [ ] 1.1 Replace document `active?: string[]` with normalized structured `ActiveEntry[]` (preset|target, id, negate) in `@b-apm/core` Manifest types
- [ ] 1.2 Implement parse/validate for structured `active` (list-of-maps + object forms, `!` negation); reject legacy bare host-token lists, empty `[]`/`{}`
- [ ] 1.3 Implement parse/validate for top-level `presets` (unique `name`, optional `dependencies`/`devDependencies`, optional nested `active`)
- [ ] 1.4 Update producer emit/validate paths to accept only structured `active`
- [ ] 1.5 Confirm overlay allowlist still rejects `presets` and validates new `active` shapes; keep whole-field `active` replace merge

## 2. Active expansion and effective deps

- [ ] 2.1 Implement pure `resolveActive` → `{ presetIds, targetIds }` with nested preset `active` walk and cycle fail-closed
- [ ] 2.2 Implement effective direct dep union (base ∪ included presets) with same-name conflict fail-closed
- [ ] 2.3 Wire expansion into dependency resolve / lock / install planning before classify/BFS
- [ ] 2.4 Wire resolved `targetIds` into install/compile host selection; preset-only `active` must not invent hosts; `--target` still overrides

## 3. Call-site and fixture churn

- [ ] 3.1 Update CLI init emit and help text that show `active: [id]` to structured `target` form
- [ ] 3.2 Grep/fix core and CLI tests/fixtures using legacy bare `active` lists to structured YAML
- [ ] 3.3 Run package checks for `@b-apm/core` and `bapm` affected by the BREAKING parse

## 4. Docs (user-facing minimum)

- [ ] 4.1 Document `presets` and structured `active` (list/object/`!`) in the manifest guide
- [ ] 4.2 Update overlay / host-selection / situations pages that show legacy `active: [cursor]` examples
- [ ] 4.3 Note that presets are base-only and personal preset/target choice uses `bapm.local.yml` `active`

## 5. Verification handoff

- [ ] 5.1 Leave behavioral coverage for acceptance phase (parse forms, negation, overlay preset pick, dep union, cycle fail); do not park those suites only in apply ad-hoc tests without acceptance
