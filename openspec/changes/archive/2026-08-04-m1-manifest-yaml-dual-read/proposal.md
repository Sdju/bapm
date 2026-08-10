## Why

bapm cannot act as a drop-in Agent Package Manager without reading and validating real OpenAPM/APM manifests from disk. Today `@b-apm/core` only stubs `parseManifest` on a pre-parsed object and knows a single `bapm.yml` constant—no YAML I/O, no `apm.yml` discovery, no OpenAPM-aligned validation. M1 unblocks every later phase (lock, resolve, install) and establishes dual-file branding without breaking existing APM projects.

## What Changes

- Add YAML load + OpenAPM-strict parse/validate for project manifests in `@b-apm/core`
- Add dual-file discovery: `apm.yml` **or** `bapm.yml` (explicit path wins; both present → hard error; neither → error; no merge; project root = cwd, no walk-up)
- Expose a core API suitable for e2e/acceptance tests (thin CLI optional; FEOD CLI not required in M1)
- Retain unknown top-level keys and `x-*` on the in-memory document model (rewrite/preserve **out of M1** — document write-back-to-same-filename for later)
- **Non-goals:** lockfile, resolve, download, install, adapters, policy, FS `.apm` package validation, MCP templates, compile, pack/`init` emit, mf-006 rewrite round-trip

## Capabilities

### New Capabilities

- `manifest-dual-file-discovery`: Resolve which manifest file to load (`apm.yml` / `bapm.yml` / explicit path) with conflict and missing-file errors
- `manifest-yaml-validate`: Load YAML safely and validate OpenAPM/APM manifest shape (required fields, deps, registries, safe-subset, extensions)

### Modified Capabilities

- (none — existing specs cover only CLI FEOD/runtime; M1 is core-domain behavior)

## Impact

- **Primary package:** `@b-apm/core` — new/extended `manifest` module (types, YAML load, validate, discovery, public exports); likely add a YAML dependency via pnpm catalog
- **Tests:** acceptance under `packages/core/tests/acceptance/m1-manifest-yaml-dual-read/` (fixtures + core API); may port/copy OpenAPM seed fixtures and exercise real `.samples/apm/apm.yml`
- **CLI:** optional thin surface only; not part of M1 MUST
- **Out of scope packages/areas:** lock, resolve, install, adapters, policy, CLI FEOD structure changes
