## 1. Manifest parse and types

- [x] 1.1 Add `active?: string[]` to `BapmManifest` and parse/validate as non-empty mf-005 token list (reject `[]`, scalars, maps, bad tokens); dual-read parity
- [x] 1.2 Preserve `active` on serialize/write paths used by producer emit; unit tests for accept/reject cases

## 2. Core host selection

- [x] 2.1 Extend install `resolveActiveTargets` (or equivalent): force → manifest `active` (multi, dedupe, all registered) → sole detect → fail; remove single-id trap for the `active` path
- [x] 2.2 Fail closed with named diagnostics when any `active` id is unregistered after map load; no partial materialize
- [x] 2.3 Wire compile selection: force → sole `active` compile-capable id → detect → fail; multi-`active` without force fails asking for `--target`

## 3. CLI help and UX copy

- [x] 3.1 Update install/compile help text to document `--target` override and manifest `active` as selection alternative when detect is missing/ambiguous
- [x] 3.2 Ensure error messages for missing/ambiguous selection MAY mention setting `active` (without removing `--target` guidance)

## 4. Documentation

- [x] 4.1 Document `active` in VitePress `guide/config-manifest` (priority, vs `target`/`targets`, empty reject, dual-read)
- [x] 4.2 Update install guide/reference (and compile situation if needed) so selection is `--target` → `active` → detect → fail

## 5. Verification

- [x] 5.1 Unit/integration coverage: sole `active` install; multi-active materialize; `--target` overrides `active`; empty/unknown fail; `apm.yml` dual-read; compile sole vs multi-`active`
- [x] 5.2 Run targeted core/cli checks for touched suites; `openspec validate manifest-active-targets --strict`
