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

## Lockfile (M2)

Public API for project lockfiles (`apm.lock.yaml` / `bapm.lock.yaml`):

- `discoverLockfilePath({ cwd?, path? })` — resolve which file to load
- `loadLockfile({ cwd?, path? })` — discover → read → safe YAML → validate (strict)
- `loadLockfileOrNull({ cwd?, path? })` — same, but `null` when neither brand file exists
- `parseLockfile` / `parseLockfileDocument` — validate YAML text or an already-parsed JS object
- `serializeLockfile(document)` → YAML string
- `writeLockfile(document, { cwd?, path?, sourcePath?, sourceFilename? })`
- `isSemanticallyEquivalent(a, b)` — ignores `generated_at` / `apm_version`
- Constants: `APM_LOCK_FILE` (`apm.lock.yaml`), `BAPM_LOCK_FILE` (`bapm.lock.yaml`)

### Dual-file discovery

- Explicit `path` always wins (no sibling-name search).
- Otherwise project root is `cwd` (default `process.cwd()`); **no parent walk-up**.
- Only `apm.lock.yaml` → load it; only `bapm.lock.yaml` → load it; **both → hard error** (no merge); neither → not-found (`loadLockfileOrNull` → `null`).
- Legacy `apm.lock` (non-`.yaml`) is **out of M2** dual-read.
- Write-back uses the loaded filename/`sourcePath`; fresh create without path → **`bapm.lock.yaml`**. Never auto-create the sibling brand.

### Emit policy (OpenAPM-preferring)

- Always emit explicit `lockfile_version`.
- Force `"2"` when any `source: registry` (and MAY bump for git-semver fields).
- **Monotonic:** never demote loaded `"2"` → `"1"` (stricter than APM demotion).
- Sort dependencies by `(repo_url, virtual_path)` (OpenAPM req-lk-005; not APM `(depth, repo_url)`).
- Normalize bare 64-hex hashes to `sha256:<hex>` on read; emit envelopes on write.
- Preserve unknown / `x-*` / APM `deployments` / `lsp_*` bags on round-trip.

### Out of M2

M2 does **not** resolve, download, install, run frozen CI, materialize integrations, or invoke `@bapm/integration-*` adapters.

See OpenSpec change `m2-lockfile-yaml-dual-read`.
