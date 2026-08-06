## 1. Parse + resolve core (G1, G2, G8, G10)

- [ ] 1.1 Add `parseMarketplaceRef` in `packages/core/src/modules/Marketplace/` (regex intent + reject `#ref` with `~^<>=!`; non-match → null)
- [ ] 1.2 Add `resolveMarketplacePlugin` + resolution/provenance helpers: `getMarketplace` → `fetchMarketplace` → `findPlugin`; map github/local/HTTPS-git sources to concrete deps; attach `discovered_via` / `marketplace_plugin_name` / optional `source_url` / `source_digest`
- [ ] 1.3 Extend Marketplace errors (`PluginNotFound`, unsupported-source); **DEFER** registry-only plugins with clear error (no Registry HTTP fallback) per design D1
- [ ] 1.4 Re-export new symbols from Marketplace `index` + `app/publicApi`; unit tests for parse match/reject and resolve local + github-shaped + miss/unsupported

## 2. Classifier + Resolver wire (G3, G4)

- [ ] 2.1 Extend `classify.ts`: string `NAME@MARKETPLACE[#ref]` → `kind: "marketplace"`; enrich object `{ name, marketplace, version? }`
- [ ] 2.2 Replace marketplace fail-closed in `resolveGraph.ts` with resolve → re-enter graph as concrete git/local; thread provenance into lock population; no bare-git fallback on miss
- [ ] 2.3 Unit/graph tests: marketplace → concrete; miss fails clearly; git `owner/repo` still not marketplace

## 3. Lock provenance (G6)

- [ ] 3.1 Ensure lock write path sets `discovered_via`, `marketplace_plugin_name`, and optional `source_url` / `source_digest` for marketplace-origin entries (concrete source retained)
- [ ] 3.2 Confirm load→serialize round-trip preserves provenance (typed fields optional); unit or lockfile fixture assert

## 4. Install positional intercept (G5)

- [ ] 4.1 Intercept positional `NAME@MARKETPLACE[#ref]` in install (CLI/core): record marketplace ref into manifest brand path and continue normal install; fail closed on miss/fetch/unsupported
- [ ] 4.2 Keep zip / non-marketplace package-ref behavior unchanged; frozen/dry-run rules still apply

## 5. Top-level search CLI (G7)

- [ ] 5.1 Add FEOD CLI `Search` module + thin `commands/search.ts` + `app/init` + registry wiring; help lists `search`
- [ ] 5.2 Implement `QUERY@MARKETPLACE` (last `@`), `--limit` default 20, `-v`; fetch + `manifest.search`; empty → exit 0 + hint; unknown market/bad expr/unknown flags → non-zero
- [ ] 5.3 Do **not** register nested `marketplace search` (S2 deferred); keep marketplace group authoring-free

## 6. Verification (G9)

- [ ] 6.1 Core/CLI unit coverage for G1–G8 behaviors above
- [ ] 6.2 Satisfy acceptance suite under `tests/acceptance/mp-search-install/` once written by acceptance phase (apply until GREEN)
- [ ] 6.3 Confirm no CONFORMANCE.md / `req-sc-*` edits; no `~/.apm` dual-read; no new host fetchers; G10 DEFER held
