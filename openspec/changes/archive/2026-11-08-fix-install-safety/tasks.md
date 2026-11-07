## 1. Acceptance tests (RED)

- [x] 1.1 Archive install: project with `.git/` and an unrelated file survives `extractPackArchive` into cwd; nothing new appears in the parent dir
- [x] 1.2 Archive install: differing existing `bapm.yml` fails closed, names the path, writes no member; identical file is not a conflict
- [x] 1.3 Downloader: default downloader against a local git repo succeeds twice into the same dest; a dest with junk files is replaced by a checkout at the commit
- [x] 1.4 MCP lock inventory: install with `${API_TOKEN}` baked from env writes the placeholder, not the value, into `bapm.lock.yaml`

## 2. Implementation (GREEN)

- [x] 2.1 `safeExtractZip` merge mode with in-dest staging and pre-write conflict check; `extractPackArchive` uses merge
- [x] 2.2 Idempotent git branch in `createDefaultDownloader`
- [x] 2.3 Pass pre-bake servers to `applyMcpInventoryToLock` in install

## 3. Verify and docs

- [x] 3.1 `vp test` for `packages/core` and `packages/cli` pass; `vp check` clean
- [x] 3.2 Manual: `bapm install` of a real GitHub git dependency succeeds twice
- [x] 3.3 Docs: drop zip/git known-issue warnings, reword the lock-secrets block to "rotate tokens committed by earlier versions"
