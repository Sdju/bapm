## Why

Object-map `target` / `targets` already parse and retain `host-id → package specifier` bindings (`manifest-target-integration-map`), but install/compile still only use map **keys** for intersection and never load the packages. Authors cannot publish `@acme/...` and actually run `bapm install --target x-acme-editor` against a declared map. Wiring the map into CLI registration closes that gap without replacing `--target` / auto-detect as the source of truth for *which* host is active.

## What Changes

- When a project manifest uses the object-map form, the CLI composition root **resolves and loads** each mapped npm package, validates it as a runtime `BapmIntegration`, and **registers** it under the map key before install/compile selection.
- Active host selection stays: `--target <id>` → else auto-detect among **registered** integrations → else fail. The map does **not** choose the active id by itself.
- Built-in `cursor` (CLI registry) continues to work **without** a map entry (extension, not replacement).
- Fail-closed when `--target X` is neither built-in/registered nor loadable from the map; fail-closed when a mapped package cannot resolve or does not export a valid runtime integration (including id mismatch).
- Document load semantics in `config-manifest` (remove absolute “values are never auto-loaded”); brief architecture / author how-to for publishing a loadable integration package.
- **Non-goals:** multi-host simultaneous materialize; treating object maps as required OpenAPM wire; changing mf-005 key grammar; auto-installing map packages as APM dependencies; marketplace-output-only packages as install targets; dedicated `path:` / workspace URI schemes beyond opaque strings Node can already resolve (follow-up).

## Capabilities

### New Capabilities

- `target-integration-dynamic-load`: Resolve/load/register runtime integrations from the manifest object-map; package export contract; fail-closed diagnostics; interaction with built-in registry and active-host selection.

### Modified Capabilities

- `install-pipeline`: Replace the “map values MUST NOT load” slice with load-before-selection semantics for object-map manifests; keep key-based intersection and unchanged active-host precedence.
- `cli-runtime-surface`: Install and compile composition roots apply map loading before passing the registry to core; unknown `--target` after map load remains fail-closed with clear remediation.

## Impact

- `@bapm/cli`: composition root / install + compile paths; dynamic import + validation helper; error messages
- `@bapm/core`: possibly thin hooks or shared helpers for “ensure map integrations registered” only if kept host-agnostic; MUST NOT import concrete `@bapm/integration-*`; update comments on `declaredTargetIntegrationMap`
- `@bapm/integration-api`: document/author contract for loadable runtime packages (factory / `BapmIntegration` shape); no catalog of hosts
- Docs: `apps/docs/guide/config-manifest.md`, `apps/docs/architecture/index.md`, short author how-to if needed
- Tests: unit (load/validate/fail-closed); CLI/acceptance for map + `--target` custom id with fixture package
