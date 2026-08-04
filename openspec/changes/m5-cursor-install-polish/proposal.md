## Why

M4 delivered install wire, primitives discovery, `bapm-target-api`, and a minimal cursor skills path — but Cursor is not yet drop-in useful (no rules/agents deploy), install UX still soft-ignores unknown flags, and soft notes (orphan inventory, `deployed_file_hashes` / lk-017 lite, test vite alias for cursor) remain open. M5 hardens **cursor-only** polish and install CLI accuracy without opening a multi-adapter catalog while `bapm-target-api` may still churn.

## What Changes

- Harden **`bapm-target-cursor`**: keep skills → `.agents/skills/`; add **instructions → `.cursor/rules/<name>.mdc`** and **agents → `.cursor/agents/<name>.md`**; detect `.cursor/` directory and SHOULD also treat legacy `.cursorrules` file; registered roots stay tg-002-safe (at least `.agents/skills` + `.cursor` and used subpaths)
- **Forced target rule (default):** explicit `--target cursor` MAY activate cursor and create registered deploy roots even when `.cursor/` is absent; **auto-detect** still requires `.cursor/` (or legacy `.cursorrules` when implemented) — no silent mkdir solely for MCP
- Extend **`bapm-target-api`** only as needed for cursor polish (e.g. materialize result / deployed path list for lock inventory) — core still depends on api only
- **Install UX (CLI):** accurate help (supported flags subset); **hard-error** unknown flags; reject `--frozen` + conflicting mutation flags (APM-like mutex); SHOULD support `--target cursor` / clear reject of unknown target ids
- **SHOULD:** orphan cleanup of previously recorded deployed files for removed deps + write `deployed_file_hashes` (lk-017 lite) so frozen can re-verify when hashes exist
- Remove **test-only vite alias** for `bapm-target-cursor` in core; use workspace resolve / CLI wiring only
- **HARD:** packages ONLY `@bapm/core`, CLI (`bapm`), `bapm-target-api`, `bapm-target-cursor` — **MUST NOT** add any other `bapm-target-*`
- **Non-goals:** second host package; multi-adapter catalog; MCP `.cursor/mcp.json` (M9); full hooks / tg-010; `--legacy-skill-paths`; M6 lifecycle commands; policy/compile/registry; commands/hooks depth beyond thin MAY

## Capabilities

### New Capabilities

- (none — extend existing M4 capabilities)

### Modified Capabilities

- `target-cursor-minimal`: Expand beyond skills-only — instructions→rules `.mdc`, agents→`.cursor/agents/*.md`; detection `.cursor/` + optional `.cursorrules`; forced-target may create roots; skills harden (idempotent, conflict-resolved only, never outside roots); MCP out
- `target-api-contracts`: Small contract extensions for materialize reporting (deployed paths / hashes input) if needed for lock inventory — keep boundary-only; no adapter catalog
- `target-package-architecture`: Lock M5 product constraint — only `bapm-target-api` + `bapm-target-cursor` among `bapm-target-*`; forbid scaffolding additional hosts in this change; drop core test vite alias workaround for cursor
- `install-pipeline`: Orphan cleanup when inventory exists; write `deployed_file_hashes` (lk-017 lite) + frozen re-verify when present; honor forced `--target` activation semantics; keep modules+lock without harness when no detect and no force
- `cli-runtime-surface`: Install help documents real flags; hard-reject unknown flags; frozen↔mutation mutex; `--target` subset; actionable errors
- `core-feod-architecture`: Confirm Install/Primitives stay FEOD-public-API only; cleanup/hash steps live in Install (or thin helper under Install), not new single-file modules / not concrete cursor imports

## Impact

- **`bapm-target-cursor`:** materialize instructions/agents; detect polish; README documents forced-target vs auto-detect rule
- **`bapm-target-api`:** optional materialize result / deployed-file report types; registry unchanged in spirit
- **`@bapm/core`:** Install path records deployed inventory, orphan cleanup, frozen hash re-verify; still **no** hard dep on `bapm-target-cursor`; remove `vite.config` path alias for cursor in tests
- **`bapm` CLI:** install arg parsing (hard unknown flags, `--target`, frozen mutex); help text; registers cursor via workspace dep as today
- **Lockfile:** use existing `deployed_file_hashes` / related fields (M2 already models them) — write on install when deploy occurs
- **Out of scope:** any second `bapm-target-*`; MCP client adapter; multi-target `all`; acceptance/production code authored in this propose phase
