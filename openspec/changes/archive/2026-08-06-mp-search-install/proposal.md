## Why

Phase 1 (`mp-consumer-registry`) shipped `~/.bapm` registry, fetch/cache, and consumer `marketplace` CLI, but users still cannot **search** plugins or **install** via `NAME@MARKETPLACE[#ref]`. Resolver still **fail-closes** `kind: "marketplace"`, so marketplace deps in manifests are unusable. This is consumer floor phase 2 — the missing resolve/search/install/provenance wire on top of the archived registry.

## What Changes

- Add core **`parseMarketplaceRef`** + **`resolveMarketplacePlugin`** (load from `~/.bapm`, fetch/cache, map plugin source → concrete git/local dep + provenance).
- **Classifier**: string `NAME@MARKETPLACE[#ref]` and object `{ name, marketplace, version? }` → `kind: "marketplace"`.
- **Resolver**: remove marketplace fail-closed; resolve to concrete kind then continue the graph (no silent bare-git fallback on miss).
- **Install**: positional intercept for marketplace refs; materialize like other installs; write lock **provenance** (`discovered_via`, `marketplace_plugin_name`; `source_url` / `source_digest` when present).
- Top-level **`bapm search QUERY@MARKETPLACE`** (`--limit` default 20, `-v`); help + fail-closed unknown flags.
- Clear errors: marketplace miss, plugin miss, fetch failure, unsupported plugin source.
- **G10 decision:** registry-routed-only plugins (`plugin.registry` without installable github/local/url coordinates) → **DEFER** with explicit unsupported-source error (experimental Registry path not shipped here).

**Non-goals:** authoring / pack / find / plugin init; CONFORMANCE / `req-sc-*` claim churn; gitlab|ado|GHES|AuthResolver host matrix; dual-read `~/.apm`; nested `marketplace search` alias (optional SHOULD, deferred); multi-marketplace wide search CLI; weakening freeze/CI/policy/insecure gates.

## Capabilities

### New Capabilities

- `marketplace-plugin-resolve`: Parse `NAME@MARKETPLACE[#ref]` (reject semver-range chars in `#ref`); resolve plugin via `~/.bapm` + phase-1 fetch; map github/local/url plugin sources to concrete deps; provenance helpers; clear miss/fetch/unsupported-source errors.
- `cli-search`: Top-level FEOD `bapm search QUERY@MARKETPLACE` with `--limit` / `-v`, last-`@` split, empty-result exit 0 + hint, help listing.

### Modified Capabilities

- `dependency-resolve`: Classify marketplace string+object forms; **remove** marketplace fail-closed; resolve then continue as git/local (registry-routed deferred per G10).
- `install-pipeline`: Positional `NAME@MARKETPLACE[#ref]` pre-resolve; lock write includes marketplace provenance fields.
- `lockfile-yaml-rw`: Round-trip preserve `discovered_via`, `marketplace_plugin_name`, and when present `source_url` / `source_digest`.
- `marketplace-cli-consumer`: Drop “search MUST NOT”; consumer group remains without authoring; top-level search owned by `cli-search`.
- `cli-runtime-surface`: Register top-level `search`; remove “search remains unregistered”; help lists `search`.
- `core-feod-architecture`: Allow Marketplace public API to expose parse/resolve; drop “Resolver marketplace fail-closed MUST remain unchanged” from phase-1 wording for this change.
- `marketplace-models`: Promote manifest `search` / `findPlugin` from optional CLI deferral to required helpers used by resolve/search (behavior already present).

## Impact

- `@b-apm/core`: `Marketplace/` resolver + errors; `Resolver/classify.ts` + `resolveGraph.ts`; `Lockfile` typed/provenance fields + serialize/parse; Install lock write path; public API re-exports.
- `bapm` CLI: new Search FEOD module + command; Install positional intercept; Help/registry wiring.
- Tests: acceptance under `tests/acceptance/mp-search-install/`; unit coverage for parse/resolve/classify/lock/search.
- Docs/design only for soft OpenAPM non-normative note; **no** CONFORMANCE.md / `req-sc-*` edits.
- Next recommended: `mp-find` (SHOULD) or product call for authoring track / `mp-hosts-auth`.
