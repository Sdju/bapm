## Context

- `safeExtractZip(bytes, dest)` extracts into a sibling staging directory (`dirname(dest)/.bapm-safe-extract-*`), then `rmSync(dest)` and `rename(staging, dest)`. That replace semantics is right for registry materialize (dest is a cache dir owned by bapm) and wrong for install-from-archive, where `extractPackArchive` passes the project cwd as dest.
- `resolveGraph` (with `skipDownload: true`) still downloads cold git trees to read child manifests; `canReuseWarm` only short-circuits when the dest already exists. Install then calls `downloadPackages`, whose default downloader runs `git clone url dest` unconditionally. Git refuses to clone into a non-empty directory.
- `runInstall` bakes `approved` servers into `configuredServers`, passes them to `configureMcp`, then passes the same baked list to `applyMcpInventoryToLock`. Nothing reads `mcp_servers` back from the lock for restore.

## Goals / Non-Goals

**Goals:** fix the three defects with the smallest behavioural surface; cover each with a test that exercises the real fs/git/zip path.

**Non-Goals:** see proposal. Also no change to registry materialize semantics or to the safe-extract caps.

## Decisions

1. **Two extract modes, one policy.** Add a `mode: "replace" | "merge"` option to `safeExtractZip` (default `replace`, keeping registry behaviour). Both modes share the same entry parsing, caps and path/symlink checks, satisfying `archive-safe-extract` "Pack and Registry share the same extract policy".
   - `merge`: stage inside `dest` (`dest/.bapm-extract-*`), validate every member, then compare each member against the existing file at the target path. If any differs → remove staging, throw listing conflicts. Otherwise copy members into place (mkdir parents, write), remove staging.
   - Alternative considered: stage in `os.tmpdir()` — rejected because `rename` across filesystems fails and the copy approach is needed anyway; staging under dest keeps everything inside the project.
   - Alternative considered: overwrite silently — rejected; the archive usually carries `bapm.yml`, and silently replacing a user's manifest is the same class of data loss.
   - Failure after partial copy (I/O error mid-copy) cannot be fully atomic without backups; acceptable because conflicts are detected before any write and the remaining failure mode is disk-level.
2. **Idempotent downloader.** In `createDefaultDownloader().download` for git: if `dest/.git` exists and `git -C dest rev-parse HEAD` equals `commit` (or no commit requested), return. Otherwise `rmSync(dest)` and clone + checkout as today. The `mkdirSync(dest)` before clone is moved to the local-path branch only (git clone creates dest itself).
   - Alternative: skip `downloadPackages` for trees resolve already fetched — rejected as it couples install to resolver internals; idempotency fixes every caller (update, lock, pack).
3. **Lock gets authored servers.** Pass `approved` (pre-bake) to `applyMcpInventoryToLock`. Order and names match `configuredServers` because bake is a per-server map.

## Risks / Trade-offs

- [Merge mode refuses archives into non-empty projects that already have a different manifest] → intended; error text tells the user to use an empty directory.
- [`rev-parse` adds one git spawn per cached package] → negligible next to clone.
- [Existing locks with baked secrets stay as is until the next non-frozen install rewrites `mcp_servers`] → docs advise rotating any token already committed.
