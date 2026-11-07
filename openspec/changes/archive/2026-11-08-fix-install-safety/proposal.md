## Why

Three install paths either destroy user data or make a core feature unusable:

- `bapm install ./file.zip` deletes the whole current directory (including `.git`) and replaces it with the archive contents.
- Every install of a git dependency fails with `Failed to download <url>`: resolve clones the package into `apm_modules/<id>/<commit>`, then the download step runs `git clone` into the same non-empty directory. Repeat installs fail the same way, so git dependencies cannot be installed at all.
- Values baked into MCP `env` (tokens from `${VAR}` / `{bake:VAR}`) are copied into the `mcp_servers` section of `bapm.lock.yaml`, a file that is meant to be committed.

Unit tests did not catch the first two because they inject fake extract/download ports.

## What Changes

- Install from a pack archive merges the archive into the project directory instead of replacing it. Files outside the archive are never removed. If an archive member would overwrite an existing file with different content, install fails before writing anything. Staging happens inside the project, not in its parent directory.
- The default downloader becomes idempotent: a git tree already materialized at the requested commit is reused; a stale or partial tree is replaced.
- The lock MCP inventory stores server declarations as authored (placeholders intact), never baked values.

Non-goals:

- `--force` semantics for archive collisions (stays a no-op; can be revisited separately).
- HTTP `headers` being dropped from agent MCP configs, multi-agent MCP, and other findings from the docs audit — tracked separately.
- Migrating or scrubbing locks that already contain baked secrets (users re-run install; docs tell them to rotate leaked tokens).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `install-pipeline`: install-from-archive must not delete existing project files and must fail closed on conflicting overwrites.
- `dependency-resolve`: downloading into the modules cache must be idempotent for trees resolve already materialized.
- `mcp-env-bake`: baked values must not be persisted in the lockfile.

## Impact

- `packages/core/src/modules/Pack/safeExtract.ts`, `Pack/extract.ts` (merge mode for project extract; registry materialize keeps replace mode).
- `packages/core/src/modules/Resolver/defaults.ts` (default downloader).
- `packages/core/src/modules/Install/runInstall.ts` (lock MCP inventory input).
- New tests in `packages/core/tests` using a local git repository and a real zip, without port fakes.
- Docs: remove the "known issue" warnings for zip and git once fixed; keep the note about rotating tokens already committed in locks.
