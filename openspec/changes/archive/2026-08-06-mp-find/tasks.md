## 1. Core Find module (G1–G4, G6)

- [x] 1.1 Create FEOD `packages/core/src/modules/Find/` (`index.ts` public API; no Marketplace imports; no single-file module)
- [x] 1.2 Implement `buildReverseIndex(document)`: dep `deployed_file_hashes` → owner key; `local_deployed_file_hashes` → `"."`; union `deployed_files` / `local_deployed_files`; de-dupe owners first-seen
- [x] 1.3 Implement `lookup(query, index)`: normalize (`\`→`/`, strip leading `/` and `./`); exact match; longest `/`-suffix directory prefix
- [x] 1.4 Implement owner label (`repo_url` || `name`; workspace `.`) and `--source` origin formatter (APM priority over lock fields)
- [x] 1.5 Implement find orchestration: load lock → index → lookup → format; exits 0/1/2; stderr lock tip mentions `bapm.lock.yaml`; reuse `whyDeps` for `--path` (root/`bapm.yml` text, empty why → label fallback); no network/writes
- [x] 1.6 Re-export Find public symbols from `app/publicApi`; unit tests for index/lookup/normalize/multi-owner/local/prefix/origin

## 2. Install dual-write S1

- [x] 2.1 In `applyDeployedHashesToLock`, when writing hash keys also sync `deployed_files` / `local_deployed_files` list membership
- [x] 2.2 Unit/fixture assert dual-write; confirm orphan cleanup still keys off hash maps only

## 3. CLI find (G5–G6)

- [x] 3.1 Add FEOD CLI `Find` module + thin `commands/find` + `app/init` + registry wiring
- [x] 3.2 Parse `PATH`, `--source`, `--path`; fail-closed unknown flags; help documents flags; call core find API
- [x] 3.3 Ensure top-level help lists `find`; CLI smoke: known/unknown/no-lock/`--source`/`--path`

## 4. Verification (G7)

- [x] 4.1 Satisfy acceptance suite under `tests/acceptance/mp-find/` once written by acceptance phase (apply until GREEN)
- [x] 4.2 Confirm no CONFORMANCE.md / `req-sc-*` edits; find path has zero Marketplace/network dependency
