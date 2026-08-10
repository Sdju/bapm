## Why

Authors want to declare not only _which_ OpenAPM host ids a project targets, but also _which npm integration package_ is intended for each host (`host-id → npm package`). Today `target` / `targets` accept only a string or string array of mf-005 tokens; that cannot express the binding, and object YAML is rejected. Extending parse/validate (with a clear non-goal on runtime loading) unlocks authoring and a typed hook for a later wiring change without breaking legacy manifests.

## What Changes

- Accept **object-map** forms for top-level `target` and `targets` on `bapm.yml` / dual-read `apm.yml`: keys are mf-005 host tokens; values are non-empty npm package specifier strings (e.g. `@b-apm/integration-claude`).
- Keep **legacy** forms: `target: <string>`, `targets: [<string>, …]`.
- Keep **mutual exclusion**: both `target` and `targets` present → parse fail (unchanged).
- Surface host ids from map keys via existing `declaredTargetIds` (intersection / tg-008 consumers keep working).
- Retain the map on the in-memory manifest and expose a small helper for future wiring; **do not** install, `require`, or register integration packages from map values in this change.
- Document both forms in the VitePress manifest guide (`config-manifest`).
- **Non-goals:** changing active-host selection (`--target` / auto-detect); dynamic integration discovery from map values; multi-host runtime materialize beyond today’s registered integrations; OpenAPM wire claim that object maps are required OpenAPM vocabulary (they are a **bapm extension**).

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `manifest-yaml-validate`: Parse/validate legacy string|array **and** object-map `target` / `targets`; reject invalid keys/values/empty maps; retain mutual exclusion and mf-005 on keys.
- `install-pipeline`: `declaredTargetIds` (and related intersection) MUST treat object-map keys as declared host ids; map values MUST NOT select or load the active integration in this change.

## Impact

- `@b-apm/core` Manifest types / `parse.ts` / target helpers; Install `declaredTargetIds`; producer emit/validate path that reuses parse
- Unit tests: parse accept/reject; `declaredTargetIds` for map form
- Docs: `apps/docs/guide/config-manifest.md` (and any short cross-links if needed)
- No new workspace packages; no CLI registration changes in this slice
