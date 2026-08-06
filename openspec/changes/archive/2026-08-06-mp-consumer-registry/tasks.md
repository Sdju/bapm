## 1. Core Marketplace scaffold (G1, G2)

- [x] 1.1 Create `packages/core/src/modules/Marketplace/` FEOD module (`errors.ts`, `types.ts`, `paths.ts`, `index.ts`) with `~/.bapm` helpers: config dir, `marketplaces.json` path, `cache/marketplace/` path, `ensureBapmConfigDir` (optional injectable `configDir`)
- [x] 1.2 Re-export Marketplace public API from `app/publicApi.ts` / package entry; confirm no imports from Registry HTTP client
- [x] 1.3 Add core unit smoke that paths resolve under a temp `configDir` and never under `~/.apm`

## 2. Models + parse (G3)

- [x] 2.1 Implement `MarketplaceSource` / `MarketplacePlugin` / `MarketplaceManifest` + kind derivation + `urlNamesRemoteManifest` per design D3
- [x] 2.2 Implement `parseMarketplaceJson` for Copilot `repository` + Claude `source`; skip npm; fail-closed malformed `registry`
- [x] 2.3 Unit fixtures: Copilot, Claude, npm-skip, duplicate-capable plugins, registry-field parse

## 3. Local registry CRUD (G4)

- [x] 3.1 Implement load/save/list/get/add/remove with `{ "marketplaces": [] }` shape, case-insensitive replace, atomic temp+rename
- [x] 3.2 Unit tests for add-replace, remove missing, empty bootstrap, not-found errors

## 4. Fetch + cache (G5–G7, G10)

- [x] 4.1 Implement cache sidecars (TTL 3600, force refresh, clear) under `cache/marketplace/` with safe key sanitization
- [x] 4.2 Implement `local` fetch (file + dir candidate paths) with path-traversal guards
- [x] 4.3 Implement `url` fetch: HTTPS-only, redirect-to-HTTP reject, ~10 MiB bound, injectable transport
- [x] 4.4 Implement `github.com` Contents API fetch + optional `GITHUB_TOKEN`/`GH_TOKEN` header; safe ref validation; path auto-detect among three candidates
- [x] 4.5 Refuse `gitlab`/`ado`/`git` kinds with clear errors; unit tests for url+local (+ github mock) and kind refuse

## 5. Thin validate (G12)

- [x] 5.1 Implement `validateMarketplace` (schema name+source, case-insensitive duplicate names); unit tests pass/fail

## 6. CLI FEOD consumer surface (G8–G9)

- [x] 6.1 Add `packages/cli` Marketplace module + thin `commands/marketplace.ts` + `app/init/marketplace.ts` + registry/`COMMAND_MARKETPLACE` wiring (FEOD)
- [x] 6.2 Implement `add` SOURCE parsing (`OWNER/REPO`, github HTTPS, marketplace.json HTTPS, local/`file://`), `--name`/`--ref`/`--host`, alias pattern, probe fetch before persist; refuse unsupported hosts
- [x] 6.3 Implement `list`, `browse`, `update` (clear+refetch), `remove` (confirm/`-y`, clear cache), `validate`
- [x] 6.4 Update top-level and marketplace help; fail-closed unknown subcommands/flags; ensure `search` stays unregistered

## 7. Verification (G11)

- [x] 7.1 Core/CLI unit suites green for G3–G10 behaviors above
- [x] 7.2 Satisfy acceptance suite under `tests/acceptance/mp-consumer-registry/` once written by acceptance phase (apply until GREEN)
- [x] 7.3 Confirm Resolver marketplace fail-closed unchanged; no CONFORMANCE.md / `req-sc-*` edits; no Registry HTTP reuse
