## Why

Marketplace track phase 6 needs a SHOULD producer: authors already declare `marketplace:` / `outputs` / `build` via archived `mp-authoring-yml`, but `bapm pack` still only writes a plain zip and never emits host `marketplace.json` for Claude/Codex. Without pack emit, the authoring floor cannot produce the lockfile-style artifacts APM writers expect, and help still claims host outputs are not shipped.

## What Changes

- Add core **MarketplaceBuilder** (or Pack-adjacent producer): load authoring config → resolve packages to concrete `ref`/`sha` (thin ambient GitHub `git ls-remote`; local `./` pass-through) → Claude + Codex mappers → atomic write of host JSON under project-root jail.
- Honor `marketplace.outputs` (defaults + per-format `path`), CLI `--marketplace` (`all`/`none`/comma list) and repeatable `--marketplace-path FORMAT=PATH`, marketplace-aware `--offline`.
- Wire **`bapm pack`**: when `marketplace:` is present and outputs are selected, emit host artifacts in the same run as plain zip when zip is warranted; **`--dry-run`** reports would-write paths with **no** durable zip or marketplace.json.
- **Keep** M7 plain-zip path, sc-007 secret refuse, and `--check-release` unchanged; marketplace emit is additive/orthogonal (`-o` does not relocate marketplace.json).
- **Marketplace-only projects:** if `marketplace:` is present and the pack set has no desire for zip (authoring-only / empty packable project intent), **skip zip** and emit JSON only — do not write an empty/minimal zip.
- **Offline / resolve failures:** fail-closed (non-zero, actionable error; no silent empty `plugins[]`).
- Update Pack + Authoring help: document marketplace pack mode; remove “pack host outputs not shipped”.
- Acceptance + unit under `**/mp-pack-outputs/`.

**Non-goals:** AuthResolver / gitlab / ado / GHES (`mp-hosts-auth`); `req-sc-*` / CONFORMANCE claim-table churn; restoring `marketplace build` verb; APM plugin-directory / tar / `--format plugin`; env `APM_MARKETPLACE_*_PATH`; nesting marketplace.json inside zip as sole distribution; SHOULD gates `--check-versions` / `--check-clean` / `--json` envelope unless cheap (defer OK).

## Capabilities

### New Capabilities

- `marketplace-pack-outputs`: Core producer for host marketplace.json — resolve authoring packages → `ResolvedPackage[]`, output profiles + path jail, Claude/Codex mappers (indent-2 + trailing newline), atomic multi-output write, dry-run, `--marketplace` filter, fail-closed offline/resolve UX.

### Modified Capabilities

- `producer-pack-archive`: Pack MAY emit host marketplace.json when authoring config + selected outputs warrant it; plain zip MUST remain the default M7 path and MUST NOT regress; marketplace-only runs MAY skip zip; dry-run covers both; new pack flags; help documents marketplace mode.
- `marketplace-cli-authoring`: Help MUST stop claiming pack host outputs are not shipped; MAY point authors to `bapm pack` for emit.
- `marketplace-authoring-schema`: Clarify that load/init/editor still MUST NOT emit host JSON as a side effect; pack (separate capability) is the emit path that consumes stored `outputs`/`build`.
- `cli-feod-architecture`: Extend existing Pack CLI module for marketplace flags and orchestration via soft IoC; no new top-level command module; no `marketplace build` verb.

## Impact

- `@bapm/core`: builder/mappers/profiles under Marketplace (fractal submodule preferred) and/or Pack orchestration that calls Marketplace public API; re-export builder entrypoints from package façade.
- `bapm` CLI: `modules/Pack` parse/help/run; Marketplace Authoring help text; integrations wiring.
- Tests: `**/mp-pack-outputs/` acceptance + unit (mappers, resolve, path jail, dry-run, zip regression, `--marketplace none`).
- Docs/help only as needed; **no** CONFORMANCE.md / claim-table edits.
- Next after archive: `mp-hosts-auth` and/or deferred SHOULD gates (check-versions/clean/json).
