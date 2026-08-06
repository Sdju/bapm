## Why

Users cannot answer “which installed package owns this deployed path?” without scanning the lock by hand. APM already ships offline `apm find PATH` over deployed inventory; bapm writes `deployed_file_hashes` / `local_deployed_file_hashes` on install but has no reverse lookup CLI. This is marketplace track phase 3 (SHOULD UX) and is **orthogonal** to marketplace resolve/search — it only needs lock inventory.

## What Changes

- Add core **offline reverse index** over lock inventory: index path keys from per-dep `deployed_file_hashes` and doc-level `local_deployed_file_hashes` (owner `"."`), **union** with `deployed_files` / `local_deployed_files` when present.
- Add **lookup** with APM-parity path normalize and longest directory-prefix match (keys ending in `/`).
- Add top-level **`bapm find PATH`** (`--source`, `--path`); default stdout = owner labels (`repo_url` || `name`; workspace `.`); exits **0** found / **1** unknown / **2** missing lock.
- Reuse existing **`whyDeps`** for `--path` why-chains (root label `bapm.yml` or existing why text — not a literal `apm.yml` copy).
- **SHOULD (S1):** Install dual-write `deployed_files` / `local_deployed_files` when writing hashes (not a find blocker).
- Help + FEOD registry wire `find`; unknown flags fail-closed.

**Non-goals:** network / marketplace / registry / auth; lock or disk writes from find; nested `marketplace find`; CONFORMANCE / `req-sc-*` churn; authoring / pack / plugin init; `find --json`; dual-read `~/.apm`; improving multi-contributor AGENTS.md attribution beyond current Install heuristics.

## Capabilities

### New Capabilities

- `find-reverse-index`: Offline core reverse index + lookup from lock inventory (hash-map keys primary; optional list union); owner labels; `--source` origin formatting; `--path` via `whyDeps`; public API for CLI; strict no-network / no-write.
- `cli-find`: Top-level FEOD `bapm find <PATH>` with `--source` / `--path`, help, fail-closed unknown flags, exit codes 0/1/2.

### Modified Capabilities

- `cli-runtime-surface`: Register top-level `find`; help lists `find`.
- `core-feod-architecture`: Domain module for find reverse-index helpers under FEOD (public `index.ts` + `app/publicApi` re-exports); MUST NOT depend on Marketplace.
- `install-pipeline`: SHOULD dual-write `deployed_files` / `local_deployed_files` alongside hash maps when Install records deployed inventory (S1; find remains correct on hash-only locks).

## Impact

- `@bapm/core`: new Find (or Lockfile/Find) helpers — `buildReverseIndex`, `lookup`, find orchestration; public API; optional Install dual-write in `deployedInventory`.
- `bapm` CLI: new `Find` FEOD module + command; Help/registry wiring.
- Tests: acceptance under `tests/acceptance/mp-find/`; unit coverage for reverse index + CLI smoke.
- Docs/design soft note only; **no** CONFORMANCE.md / marketplace dependency for find path.
- Next after archive: product call for `mp-plugin-init` / authoring **or** stop consumer-floor track.
