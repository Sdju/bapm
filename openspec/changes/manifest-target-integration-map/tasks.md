## 1. Manifest types and parse

- [x] 1.1 Add `TargetIntegrationMap` and widen `BapmManifest.target` / `targets` unions in Manifest types
- [x] 1.2 Extend `parseManifestDocument` to accept object-map forms (mf-005 keys, non-empty string values, reject empty maps / bad shapes); keep legacy string/array + mutual exclusion
- [x] 1.3 Unit tests: accept map / legacy; reject invalid keys, empty values, empty `{}`, both fields present, wrong types

## 2. Declared ids and wiring helper

- [x] 2.1 Update `declaredTargetIds` to return object-map keys; add `declaredTargetIntegrationMap` (undefined for legacy forms)
- [x] 2.2 Export helper from Manifest/Install public surfaces as designed; unit tests for keys + map retention
- [x] 2.3 Confirm install intersection path uses updated `declaredTargetIds` (existing tg-008 tests still pass; add map-key case if cheap)

## 3. Docs and verify

- [x] 3.1 Document object-map `target` / `targets` in `apps/docs/guide/config-manifest.md` (bapm extension; keys vs values; no auto-load; prefer `targets` for multi-host; dual-read `apm.yml`)
- [x] 3.2 Run focused Manifest + Install target tests; mark tasks done
