## Why

bapm has no consumer marketplace surface: users cannot register `marketplace.json` sources, browse plugins, or refresh a local index. APM already ships this as the first half of the consumer floor; without a dedicated Marketplace domain (orthogonal to Registry HTTP), the next slice (`mp-search-install`) has nothing to resolve against. Locked product defaults (2026-08-06) put consumer floor phase 1 first.

## What Changes

- Add `@b-apm/core` domain module `Marketplace/` (models, `~/.bapm` paths, local registry CRUD, fetch/cache for **github | url | local** only) — **not** an extension of `Registry/` HTTP.
- Introduce user-config root **`~/.bapm`**: `marketplaces.json` + sidecar cache under `cache/marketplace/` (TTL ~1h; force refresh on `update` / probe).
- Parse Copilot (`repository`) + Claude (`source`) `marketplace.json`; skip npm source entries; keep plugin `registry` field parsed but unused until install.
- Wire CLI FEOD `marketplace` group: **`add` | `list` | `browse` | `update` | `remove` | thin `validate`** (schema + duplicate plugin names; `--check-refs` OOS).
- Security floors: HTTPS-only for `url` kind (reject HTTP / redirect-to-HTTP), ~10 MiB body bound, safe alias/ref patterns, local path-traversal guards.
- Help + fail-closed unknown marketplace subcommands/flags; top-level help lists `marketplace`.

**Non-goals:** `search` / top-level `search`; `NAME@MARKETPLACE` resolve/install / lock provenance; gitlab|ado|generic-git fetchers; dual-read `~/.apm`; authoring/plugin/pack/find; CONFORMANCE / `req-sc-*` claim churn; reusing Registry HTTP client or `BAPM_EXPERIMENTAL_REGISTRIES` for marketplace.json; weakening Resolver marketplace fail-closed deps.

## Capabilities

### New Capabilities

- `marketplace-models`: Immutable Source / Plugin / Manifest types and `parseMarketplaceJson` for Copilot+Claude formats (skip npm; parse unused `registry` field).
- `marketplace-local-registry`: `~/.bapm` config root helpers and atomic CRUD for `marketplaces.json` (`{ "marketplaces": [...] }`), case-insensitive name replace/remove/list/get.
- `marketplace-fetch-cache`: Fetch dispatch for github.com Contents API (or equivalent), HTTPS direct `url`, and `local` file/dir with three candidate paths; sidecar cache TTL ~1h + clear/force_refresh; refuse other kinds.
- `marketplace-cli-consumer`: FEOD CLI `bapm marketplace add|list|browse|update|remove|validate` with SOURCE parsing, confirm/`-y` remove, help, and fail-closed unknown flags/subcommands.

### Modified Capabilities

- `core-feod-architecture`: Require new core `Marketplace` directory module with public `index.ts`; re-export from package entry; MUST NOT hang off Registry.
- `cli-feod-architecture`: Require CLI `Marketplace` module + thin `commands/marketplace` + `app/init` wiring under locked FEOD rules.
- `cli-runtime-surface`: Register `marketplace` in dispatch/help; document consumer subcommands; unknown marketplace tokens fail-closed.

## Impact

- `@b-apm/core`: new `modules/Marketplace/**`, `app/publicApi` re-exports, unit fixtures for parse/registry/fetch.
- `bapm` CLI: `modules/Marketplace`, `commands/marketplace.ts`, `app/init/marketplace.ts`, `app/registry.ts`, Help listing, constants.
- Tests: acceptance under `tests/acceptance/mp-consumer-registry/` (RED→GREEN later); core/CLI unit coverage for G3–G10.
- Docs: design documents `~/.bapm` paths; no CONFORMANCE.md edits.
- Next recommended change: `mp-search-install`.
