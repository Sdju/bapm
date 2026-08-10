## 1. target-api materialize report

- [x] 1.1 Extend `bapm-target-api` types so `materialize` can report deployed relative paths (and optional hashes) without adding host-catalog/MCP APIs
- [x] 1.2 Export updated types from package entry; document the report shape in `packages/target-api` README
- [x] 1.3 Confirm `@b-apm/core` still depends only on `bapm-target-api` among `bapm-target-*`

## 2. Cursor detect + materialize polish

- [x] 2.1 Update cursor `detect`: `.cursor/` directory **or** legacy `.cursorrules` file; keep registered roots including `.agents/skills` and `.cursor`
- [x] 2.2 Harden skills materialize: conflict-resolved only; idempotent overwrite; never write outside roots; never write `.cursor/mcp.json`
- [x] 2.3 Materialize instructions → `.cursor/rules/<name>.mdc` and agents → `.cursor/agents/<name>.md` (thin copy/write)
- [x] 2.4 Return materialize deployed-path report via api contract; document forced-target vs auto-detect in `packages/target-cursor` README
- [x] 2.5 Verify workspace still has only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*` (no new host packages)

## 3. Core Install: inventory, cleanup, forced target, frozen hashes

- [x] 3.1 Thread forced target id through Install public options; activate registered target even when `detect` is false; reject unknown forced ids
- [x] 3.2 After materialize, write `deployed_file_hashes` into lock inventory (stable hash algo documented); skip inventing inventory when no deploy
- [x] 3.3 Implement orphan cleanup: remove only previously recorded harness paths for deps dropped from the resolve set; no-op if inventory absent
- [x] 3.4 On frozen: re-verify `deployed_file_hashes` when present (lk-017 lite); keep lk-006 gate; no lock rewrite on success
- [x] 3.5 Keep all logic under `modules/Install` (+ `common` helpers if needed); no import of `bapm-target-cursor`; public API via `index.ts` only

## 4. Remove core vite cursor alias / relocate e2e

- [x] 4.1 Remove `bapm-target-cursor` path alias from `packages/core/vite.config.ts`
- [x] 4.2 Replace core tests that imported real cursor via alias with mock `BapmTarget` via api **or** move real cursor e2e to `packages/cli` / `packages/target-cursor`
- [x] 4.3 Confirm core `package.json` still has no `bapm-target-cursor` dependency

## 5. CLI install UX (FEOD)

- [x] 5.1 Harden `parseInstallArgs`: hard-error unknown flags; keep `--frozen` + `--update` mutex; parse `--target <id>`
- [x] 5.2 Pass forced target into core install; reject unregistered target ids with clear stderr
- [x] 5.3 Update help surfaces so install documents `--frozen` / `--target` subset and is not described as a stub
- [x] 5.4 Keep `commands/install.ts` thin; registration of cursor remains in CLI module/init (workspace dep)

## 6. Verification (apply; acceptance authored separately)

- [x] 6.1 Keep M1–M4 regressions green; `bapm lock` still does not deploy harness files
- [x] 6.2 Run build/test/`vp check` for `@b-apm/core`, `bapm`, `bapm-target-api`, `bapm-target-cursor` and fix in-scope regressions
- [x] 6.3 Spot-check package graph: only api+cursor among `bapm-target-*`; no core→cursor hard dep; no vite cursor alias
- [ ] 6.4 (Optional MAY) CI-default frozen lk-018 — only if cheap; not required to close M5 tasks
