# @bapm/core

Domain library for **bapm** (Better Agent Package Manager): manifest, lockfile, resolver, install, adapters.

## Manifest (M1)

Public API for project manifests:

- `discoverManifestPath({ cwd?, path? })` — resolve which file to load
- `loadManifest({ cwd?, path? })` — discover → read → safe YAML → validate
- `parseManifest` / `parseManifestDocument` — validate an already-parsed JS object
- Constants: `APM_MANIFEST_FILE` (`apm.yml`), `BAPM_MANIFEST_FILE` (`bapm.yml`)

### Dual-file discovery

- Explicit `path` always wins (no sibling-name search).
- Otherwise project root is `cwd` (default `process.cwd()`); **no parent walk-up**.
- Only `apm.yml` → load it; only `bapm.yml` → load it; **both → hard error** (no merge); neither → error.
- Result metadata includes `sourcePath` / `sourceFilename` so a future rewrite **MUST** write back to the same filename (never auto-create the sibling brand name). Rewrite/mf-006 itself is **deferred** past M1.

### OpenAPM-strict YAML

Load rejects YAML anchors/aliases and custom tags (OpenAPM req-mf-020). This is intentionally stricter than APM’s budgeted SafeLoader when APM would accept anchors within an expansion budget.

Validation covers required `name`/`version` strings, dependency/registry shapes (including `git`+`path` companion, required `path` for `git: parent`, `registries.default` as a name pointer, and allowlisted dep meta such as `alias`), unknown/`x-*` retention on the in-memory document, `workspaces` reject, and mutual exclusion of `target`+`targets`. M1 does **not** resolve, lock, download, or install.

See the monorepo root README and OpenSpec change `m1-manifest-yaml-dual-read`.
