## 1. Core authoring schema (G1–G2, MUST 1–4, 9)

- [x] 1.1 Add authoring types (`MarketplaceAuthoringConfig` / `PackageEntry` or equivalent) under `packages/core` Marketplace (fractal `modules/Authoring/` preferred); keep separate from consumer `marketplace.json` models
- [x] 1.2 Implement source validators (req-mf-017 / APM `SOURCE_RE`): accept `owner/repo`, `host.tld/…`, `https://…`, `./…`; refuse `..`, userinfo, ports, query, bare relative locals
- [x] 1.3 Implement `loadMarketplaceFromBapmYml` (+ legacy loader): strict unknown keys in `marketplace:`; inherit top-level name/description/version; parse/store `owner`, `build`, `outputs` without emit
- [x] 1.4 Implement `detectAuthoringConfigSource` (preferred block / legacy / both→error / none→init hint); export public API via Marketplace `index.ts` + package entry
- [x] 1.5 Unit tests under `**/mp-authoring-yml/` for load, inherit, unknown keys, source reject/accept, detect both/none

## 2. YAML editor + init template (G3, G5, MUST 5–6)

- [x] 2.1 Implement package add/update/remove editor against `bapm.yml` with re-validate; prefer atomic write + restore-on-fail
- [x] 2.2 Implement init template renderer (`owner`, example package, `build.tagPattern`, `outputs.claude`) without writing host marketplace.json
- [x] 2.3 Unit tests for editor round-trip and template shape (no emit side effects)

## 3. Check + thin ls-remote (G6, MUST 7, S5)

- [x] 3.1 Implement authoring check: schema path; `--offline` = no network; online github `owner/repo` via ambient `git ls-remote`; local schema-only; non-github fail-soft warning (design D5)
- [x] 3.2 Wire optional `package add` default verify via `git ls-remote` unless `--no-verify`; skip/warn for non-github
- [x] 3.3 Unit tests with mocked/`--offline` paths for check and verify

## 4. FEOD CLI authoring surface (G4, MUST 5–8, 11)

- [x] 4.1 Extend CLI Marketplace module: register `init`, `package` (add|set|remove), `check`; parse flags (`--force`, `--owner`, `--name`, package flags, `--offline`, `-y`); keep consumer verbs
- [x] 4.2 Help: Authoring section separate from Consumer; do not claim pack emit / `build` / `outdated` / `audit` as shipped
- [x] 4.3 Soft IoC: expose new core APIs via `app/integrations`; thin `commands/marketplace.ts` only; no new top-level authoring module; no direct `@b-apm/core` in commands/
- [x] 4.4 Update tests that previously asserted authoring subcommands absent (e.g. search-help / marketplace FEOD) to match new registration

## 5. Optional thin migrate (S1 / design D8)

- [x] 5.1 If capacity after 1–3: implement `marketplace migrate` (fold `marketplace.yml` → `bapm.yml` `marketplace:`; `--dry-run`; `--force`/`-y`); else omit registration entirely (no stub)
- [x] 5.2 If shipped: help lists `migrate` under Authoring; unit/acceptance coverage for dry-run no-write

## 6. Verification (G7, MUST 10–11)

- [x] 6.1 Satisfy acceptance under `tests/acceptance/mp-authoring-yml/` (init→package→check --offline + source reject; online mock/ls-remote if feasible)
- [x] 6.2 Confirm no pack emit, no CONFORMANCE/`req-sc-*` claim-table churn, no consumer validate/search/install/find rework beyond wiring new verbs; `validate NAME` still consumer-only
