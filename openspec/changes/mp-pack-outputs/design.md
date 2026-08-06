## Context

See proposal.md for motivation. Baseline: archived `mp-authoring-yml` loads/stores `marketplace:` including `outputs` / `build` without emit; `bapm pack` is plain-zip only (`Pack/runPack.ts` + CLI Pack module) with `--archive` / `--dry-run` / `--check-release` / `--tag`; Authoring help still says pack host outputs are not shipped. Criteria lock D1–D11 and gaps G1–G7; APM parity targets are `MarketplaceProducer` + `builder` / `output_mappers` / `output_profiles` (no AuthResolver). FEOD: extend Pack CLI + core Marketplace (fractal builder), not a new verb.

## Goals / Non-Goals

**Goals:**

- Core builder: authoring load → `ResolvedPackage[]` → Claude/Codex JSON → atomic multi-output write with path jail.
- Pack orchestration: additive marketplace emit beside plain zip; marketplace-only skip zip; fail-closed offline/resolve.
- CLI flags + help truthfulness; acceptance under `**/mp-pack-outputs/`.

**Non-Goals:**

- `mp-hosts-auth`, CONFORMANCE/`req-sc-*` churn, `marketplace build` verb, plugin/tar formats, env path overrides, SHOULD gates (`--check-versions` / `--check-clean` / `--json`) as MUST.

## Decisions

### D1 — Builder lives under Marketplace fractal, Pack orchestrates

- **Choice:** Implement resolve/profiles/mappers/write under `packages/core/src/modules/Marketplace/modules/` (e.g. `PackOutputs` / `Builder` fractal) with exports via Marketplace → package façade. `Pack.runPack` (or a thin `runPackWithMarketplace` orchestrator beside it) detects authoring config, calls builder when outputs selected, then runs existing zip path when warranted.
- **Why:** Keeps consumer JSON models separate; authoring types already in Marketplace; Pack stays producer entry (criteria D2/G5).
- **Alternatives:** All logic inside Pack module — rejected (wrong domain for mappers); new top-level core module — only if size forces it.

### D2 — Marketplace-only skips zip (resolves open question)

- **Choice:** If `marketplace:` present and outputs selected, and the project lacks a packable M7 tree (no dual-read packable content / empty pack set that would currently fail `assertProjectHasContent`), emit JSON only and **skip zip**. Do not write empty/minimal zip. If both packable content and marketplace outputs exist, do both in one run when archive requested.
- **Why:** Criteria open question + D11; APM-like marketplace-only projects; avoids useless empty archives.
- **Alternatives:** Always require `--archive` zip — rejected for marketplace-only; empty zip placeholder — rejected.

### D3 — Offline / resolve fail-closed (resolves open question)

- **Choice:** Missing concrete ref/sha → non-zero + actionable error; `--offline` does not silently reuse last on-disk marketplace.json. Local `./` still OK offline. Non-github remotes without AuthResolver → fail closed for pack emit (stricter than authoring check’s fail-soft warn), because emit needs concrete sources.
- **Why:** Criteria G7 / prefer fail-closed; silent empty plugins forbidden.
- **Alternatives:** Reuse on-disk JSON — rejected; schema-only emit without sha — rejected for remotes.

### D4 — Output selection parity with APM

- **Choice:** Drive from `config.outputs`; CLI `--marketplace all|none|list` filters; default paths Claude `.claude-plugin/marketplace.json`, Codex `.agents/plugins/marketplace.json`; `--marketplace-path FORMAT=PATH` repeatable; jail via resolve-under-cwd (APM `ensure_path_within` intent). Unknown format → hard error.
- **Why:** Criteria D4–D7 / G2 / G4.

### D5 — Mappers byte-shape for happy paths

- **Choice:** Port Claude + Codex mapper intent (strip APM-only fields; Codex requires `category`). JSON: indent 2 + trailing newline. Cosmetic metadata enrichment SHOULD/fail-soft; skip remote enrichment offline.
- **Why:** Criteria MUST 3–4 / G3.

### D6 — Atomic write + single resolve

- **Choice:** Resolve packages once per pack run; loop selected profiles; atomic write per file; dry-run prints paths, no durable write (zip or JSON).
- **Why:** APM `MarketplaceProducer` / builder; G4.

### D7 — Thin ls-remote reuse

- **Choice:** Reuse authoring github shorthand helpers + injectable `lsRemote` for tests (same pattern as `checkMarketplaceAuthoring`). Explicit `ref` → resolve that ref’s sha; version range → tags matching `tagPattern` / entry `tag_pattern`.
- **Why:** Criteria D8 / G1; no AuthResolver.

### D8 — No CONFORMANCE / sc-* churn

- **Choice:** Do not edit claim tables or activate skipped `req-sc-*`. sc-007 pack refuse stays as-is.
- **Why:** Criteria D10 / MUST NOT 3.

### D9 — Deferred SHOULD gates

- **Choice:** `--check-versions` / `--check-clean` / machine `--json` envelope are optional follow-ups; omit from MUST tasks. `--include-prerelease` MAY wire if cheap for range resolve.
- **Why:** Criteria D9 / S1–S3; XL pressure.

### D10 — Codex-only requires explicit outputs.codex + category

- **Choice:** Codex emit only when outputs select codex; missing category → fail closed before write.
- **Why:** Criteria open question / MUST 4.

## Risks / Trade-offs

- [Zip vs marketplace-only detection brittle] → Define clear predicate: existing `collectPackFiles` + `assertProjectHasContent` failure path becomes “marketplace-only eligible” only when marketplace outputs selected; document in tasks; acceptance covers both branches.
- [ls-remote flaky in CI] → Inject/mock in unit; acceptance prefer local `./` fixtures for MUST emit; online path optional/mocked.
- [Authoring help/tests assert “not shipped”] → Update help + any fixtures asserting the old string.
- [Accidental claim-table edits] → Tasks forbid; review allowlist.
- [Non-github pack fail harder than check] → Document in help; hosts-auth later.

## Migration Plan

- Additive core APIs + Pack flags; existing zip-only projects unchanged.
- Authors with `marketplace:` + `outputs.claude` gain emit on next `bapm pack`.
- Rollback: remove builder call + flags; restore prior help line if needed.

## Open Questions

None blocking. Deferred: hosts-auth resolve matrix; SHOULD version/drift gates; env `APM_MARKETPLACE_*_PATH`.
