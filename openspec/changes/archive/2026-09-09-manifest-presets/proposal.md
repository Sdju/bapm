## Why

Projects need optional, named dependency bundles (role presets such as `analyst` / `developer`) that contributors turn on deliberately—without baking every role into the shared base graph or conflating that choice with host `target` integration packages. Today `active` only lists host ids; extending it to presets (with negation and overlay-friendly forms) gives a single activation surface for both hosts and dependency sets. Nothing in production relies on the old targets-only `active` shape, so the semantics can be redefined without a migration path.

## What Changes

- Add top-level `presets` on the project manifest: named entries with ordinary dependency settings and optional nested `active` for advanced composition.
- **BREAKING:** Redefine top-level `active` from a plain list of host tokens to structured selection of **presets** and/or **targets**, supporting list-of-maps and object forms, string/array values, and leading `!` negation (e.g. override a parent or base selection).
- Resolve/install (and lock) MUST build the effective dependency graph as **base deps ∪ deps from included presets**, applying negation/overrides when computing the included set.
- Nested/chained `active` that recurses through presets (`preset → active → preset → …` cycle) MUST fail closed.
- `bapm.local.yml` already allowlists `active`; new `active` forms MUST validate and merge there so individuals can pick presets/targets personally. Defining `presets` remains base-manifest-only (not overlay allowlist).
- User-facing docs for presets and the new `active` syntax (minimum coverage in tasks).
- Acceptance tests land in later orchestration phases (not this propose).

### Non-goals

- No migration / dual-read of legacy bare-string `active: [cursor]` lists as host-only arrays (callers rewrite to `target:` / structured forms).
- No change to host integration package loading (`target`/`targets` object-map) or to dependency source discriminator `local:` / `local`.
- Presets are not a substitute for host `target` map bindings or for CI frozen lock policy.

## Capabilities

### New Capabilities

- `manifest-presets`: Declare named presets, expand included presets into the effective dependency set, nested `active` on presets, and fail-closed recursion detection when resolving preset→active chains.

### Modified Capabilities

- `manifest-yaml-validate`: Parse/validate `presets` and the new structured `active` (list-of-maps / object; `preset`/`target` keys; `!` negation; reject legacy bare host-token arrays and invalid shapes).
- `manifest-active-targets`: Host activation uses the **target** portion of structured effective `active` (not preset names); preserve `--target` override, unknown-id fail-closed, and compile sole-target rules against resolved target ids.
- `manifest-local-overlay`: Overlay `active` accepts the new structured forms with the same validation as the base; merge remains whole-field replace for `active`; `presets` stays disallowed on the overlay.
- `dependency-resolve`: Effective direct dependency inputs for resolve are base manifest deps unioned with deps from included presets after active resolution.

## Impact

- `@b-apm/core` Manifest parse/validate and any active-normalization helpers; overlay merge; resolve/install planning that currently reads root `dependencies` / `devDependencies` and `active` as `string[]`.
- CLI help / init samples that emit `active: [cursor]` MUST emit structured `active` (target form).
- Docs: manifest guide, host-selection / overlay situations, reference pages mentioning `active`.
- Specs that assume `active: [cursor]` as a YAML sequence of host tokens (e.g. install-pipeline / cli-runtime examples) remain behaviorally about **resolved target ids**; implementation fixtures and narrative examples should adopt structured syntax where they assert parse shape.
