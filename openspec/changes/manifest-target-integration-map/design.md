## Context

See `proposal.md` for motivation. Today `packages/core` Manifest parse accepts only `target?: string` and `targets?: string[]` (mf-005 tokens), with mutual exclusion. Install `declaredTargetIds` reads those shapes for tg-008 intersection; active host selection is `--target` / registry detect — manifest fields do not pick the integration implementation. Runtime install remains cursor-registered; Claude/Codex are marketplace-output oriented. Authors want YAML object maps as a typed hint binding host id → npm integration package without waiting for full dynamic integration loading.

## Goals / Non-Goals

**Goals:**

- Dual-shape parse/validate for `target` / `targets` (legacy + object map) on the shared Manifest path (`bapm.yml` and dual-read `apm.yml`).
- Type model + retention of map values; `declaredTargetIds` returns map keys.
- Small public helper exposing the integration map when present (задел под wiring).
- Docs on `config-manifest` describing both forms and the bapm-extension / non-activation semantics.

**Non-Goals:**

- Installing or dynamically importing npm packages named in map values.
- Changing detect / materialize / CLI integration registration to consume the map.
- Claiming object maps as OpenAPM-required wire (document as bapm extension).
- Allowing both `target` and `targets` simultaneously.
- Strict npm semver-range grammar for values beyond “non-empty string”.

## Decisions

### 1. Scope this slice to parse + types + declared ids + docs

- **Choice:** Implement validation and model retention now; defer runtime wiring of map values to a later change that can depend on this helper.
- **Why:** Matches product reality (cursor-only runtime registration) and avoids half-broken dynamic `require` of arbitrary packages from YAML.
- **Alternatives:** Full dynamic load in the same change — rejected (security, registry, FEOD/CLI registration surface).

### 2. Same object shape for both `target` and `targets`

- **Choice:** Both fields MAY be a non-empty `Record<string, string>` (host → package). Singular `target` with multiple keys is allowed (same validation as `targets` map); authors SHOULD prefer `targets` for multi-host.
- **Why:** User examples use both fields as maps; keeping one validator avoids special-casing “exactly one key” for `target`.
- **Alternatives:** Restrict `target` map to exactly one entry — deferred; can tighten later without breaking multi-key if we never promised single-key-only.

### 3. Keys = mf-005; values = non-empty npm specifier strings

- **Choice:** Reuse `isValidTargetToken` for keys. Values: trim, require non-empty string; no network resolve; no package-name regex beyond non-empty (accept `@scope/name`, bare names, optional `name@version` text as opaque string).
- **Why:** Keeps OpenAPM host vocabulary intact; avoids inventing a second token grammar for packages in v1.
- **Alternatives:** Strict npm package name regex — optional later if false positives matter.

### 4. Mutual exclusion unchanged; no mixed array/object

- **Choice:** Presence of both fields → error. `targets` is either string[] **or** object map, never a mixed list of strings and objects.
- **Why:** Preserves tg-008 clarity; YAML ambiguity is fail-closed.

### 5. `declaredTargetIds` + `declaredTargetIntegrationMap`

- **Choice:** Extend `declaredTargetIds` to return `Object.keys` for map forms. Add `declaredTargetIntegrationMap(manifest): Readonly<Record<string, string>> | undefined` returning the map when object form is used, else `undefined` (legacy string/array has no package bindings).
- **Why:** Intersection consumers stay id-centric; future install/CLI wiring has one place to read bindings.
- **Alternatives:** Overload return type of `declaredTargetIds` — rejected (breaks callers expecting `string[]`).

### 6. Types on `BapmManifest`

- **Choice:**
  ```ts
  export type TargetIntegrationMap = Record<string, string>;
  target?: string | TargetIntegrationMap;
  targets?: string[] | TargetIntegrationMap;
  ```
- **Why:** Minimal, accurate union; serialize/write continues to dump retained structure.

### 7. Docs framing

- **Choice:** Document object map as a **bapm extension** hint for authors; state clearly that active host is still `--target` / detect and that map values are not loaded by install yet.
- **Why:** Honest conformance posture (same pattern as `local` source).

## Risks / Trade-offs

- [Authors assume map auto-installs integrations] → Mitigation: docs + helper README/comment; acceptance scenarios assert non-load.
- [Multi-key `target` surprises OpenAPM readers] → Mitigation: docs prefer `targets` for multi-host; validation still correct.
- [Opaque package strings later need stricter grammar] → Mitigation: non-empty only now; can tighten with warnings then errors.
- [Producer emit / createMinimal still string-only] → Mitigation: tasks update emit validation via shared parse; init MAY keep string `target: cursor` (no forced map).

## Migration Plan

- Purely additive parse acceptance; existing string/array manifests unchanged.
- No lockfile migration.
- Rollback: revert parse union (object maps start failing again).

## Open Questions

- None blocking this slice. Future change: whether CLI should auto-register integrations from map values (npm resolve + trust model).
