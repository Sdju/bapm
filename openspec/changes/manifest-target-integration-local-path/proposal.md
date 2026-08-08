## Why

Authors developing a host integration in-tree (or beside the consumer project) currently must publish or link an npm package before object-map `target` / `targets` can load it. Extending map values to filesystem paths (with Node-style directory resolution) unblocks local iteration without inventing a `path:` URI scheme, while keeping npm package strings working.

## What Changes

- Treat object-map values that look like filesystem paths (`./…`, `../…`, absolute `/…`) as local integration modules resolved relative to the project / manifest cwd (dual-read root), not only as npm package names.
- Resolve directories via the same Node module resolution the CLI loader already uses (`createRequire` → entry from `package.json` exports/main / `index.*`), then dynamic `import()`; explicit file paths (e.g. `index.js` / `.mjs`) when already supported by that resolve.
- Fail-closed when the path is missing, unresolvable, or escapes the project root (containment); keep existing fail-closed export / id-mismatch behavior.
- Keep bare npm package strings (`@scope/name`, `pkg`) unchanged; do **not** introduce a first-class `path:` map URI unless needed for disambiguation (prefer `./` / `/` heuristics).
- Update VitePress `config-manifest` and author how-to with local-path examples.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `target-integration-dynamic-load`: Map values MAY be local filesystem paths in addition to npm package specifiers; define path heuristics, cwd root, Node resolution, project-root containment, and docs expectations.
- `cli-runtime-surface`: Install/compile composition continues to apply dynamic load; clarify that local-path map values are in scope for the same fail-closed registration step (docs/help MAY mention local paths).

## Impact

- `packages/cli` — `loadManifestIntegrations.ts` (and tests): path detection, containment under project cwd, resolve/import for local dirs/files; npm path unchanged.
- `apps/docs` — `guide/config-manifest.md`, `architecture/index.md` author how-to (local path examples).
- No Manifest parse changes (values remain opaque non-empty strings).
- No Core resolver / APM `path:` dependency-source changes; containment is CLI-loader-local (aligned with project-root policy used elsewhere).
- Non-goals: `path:` / `workspace:` URI grammar; network install of map packages; changing active-host selection; marketplace-only packages as runtime loads; symlink-escape hardening beyond lexical containment unless already cheap.
