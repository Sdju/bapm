## Context

See proposal.md — Why. Criteria: `.samples/apm-knowledge/topics/mp-search-install-criteria.md`. Baseline after archived `mp-consumer-registry`: `Marketplace/` models + `~/.bapm` registry + fetch/cache + consumer CLI; Resolver still fail-closes `kind: "marketplace"`; string `NAME@MARKETPLACE` not classified; no top-level `search`; install has no marketplace positional intercept; lock has open index signature but no first-class provenance fields. APM mirrors: `marketplace/resolver.py`, `models.py` search, `commands/marketplace` search (top-level), `install.py` intercept, `deps/apm_resolver.py`, lockfile provenance keys.

## Goals / Non-Goals

**Goals:**
- Close gaps G1–G10 (G10 decision locked below).
- Wire Resolver + Install + lock provenance + top-level search on phase-1 registry only.
- Keep FEOD boundaries: Marketplace owns parse/resolve; Resolver/Install call in; no Registry HTTP for `marketplace.json`.

**Non-Goals (design-level):**
- Nested `marketplace search` alias (S2 deferred).
- First-class Lockfile type fields beyond preserve-if-present (S3 optional — index signature OK if round-trip proven).
- Enterprise cross-repo / AuthResolver / GHES matrix (S4 → `mp-hosts-auth`).
- Multi-marketplace `search_all` CLI (S5 OOS).
- CONFORMANCE / `req-sc-*` claim edits.

## Decisions

### D1 — G10 registry-routed plugins: **DEFER**

**Choice:** If a plugin has installable github / local / HTTPS-git coordinates, resolve those and **ignore** `plugin.registry` for routing in this change. If the only route is `plugin.registry` (+ version) without concrete github/local/url source, **fail closed** with a clear unsupported/deferred message (do not call experimental Registry HTTP, even when `BAPM_EXPERIMENTAL_REGISTRIES` is set).

**Rationale:** Keeps marketplace.json I/O orthogonal to Registry HTTP (criteria MUST NOT); avoids half-shipping experimental registry resolve inside marketplace floor; S1 remains a follow-up.

**Alternative considered:** Ship thin registry-routed path behind experimental flag (APM parity) — rejected for this slice as scope creep / host+registry coupling.

### D2 — Parse + resolve live in Marketplace module (G1, G2, G8)

**Choice:** Add `parseMarketplaceRef` / `resolveMarketplacePlugin` (+ resolution + `provenance()` helper) under `packages/core/src/modules/Marketplace/` (e.g. `resolver.ts`), re-export via module `index` + `app/publicApi`. Extend errors with `MarketplacePluginNotFoundError` and unsupported-source error (reuse `MarketplaceNotFoundError` / `MarketplaceFetchError` where applicable).

**Rationale:** Matches APM `marketplace/resolver.py`; Resolver stays orchestration-only.

### D3 — Classifier order (G3)

**Choice:** In string classification, attempt `parseMarketplaceRef` **before** generic `owner/repo` / `@`-bearing fallbacks. Object form: `{ marketplace: string }` with `name` (+ optional `version`/`ref`) → `kind: "marketplace"` (enrich classified payload with name/version). Keep marketplace non-normative in comments/docs only — no CONFORMANCE churn.

**Rationale:** Prevents `NAME@MARKETPLACE` being misclassified as invalid or git.

### D4 — Resolver wire (G4)

**Choice:** Replace the fail-closed block in `resolveGraph` for `kind: "marketplace"` with: call `resolveMarketplacePlugin` → obtain concrete dep declaration + provenance → re-classify / continue existing git/local paths. Thread a provenance map (identity → provenance fields) into lock population (mirror APM `_resolve_marketplace_dep`). On miss/fetch/unsupported: throw ResolverError wrapping marketplace error messages (no bare-git fallback).

**Rationale:** Criteria MUST 3; removes phase-1 intentional deferral.

### D5 — Install positional intercept (G5)

**Choice:** In CLI/core install positional handling, if `parseMarketplaceRef(arg)` matches, pre-resolve (or record marketplace string into `dependencies.apm` and let graph resolve handle — prefer **record string form** `NAME@MARKETPLACE[#ref]` into manifest then normal install, matching APM intercept intent). Fail before success claim on resolve errors. Zip / non-marketplace refs unchanged.

**Rationale:** Consumer UX parity; Resolver remains single graph authority.

### D6 — Lock provenance (G6)

**Choice:** On lock write for marketplace-origin entries, set `discovered_via`, `marketplace_plugin_name`; copy `source_url` / `source_digest` when present on resolution/manifest. Keep concrete `source` as resolved kind (`git` / `local` / …) — **not** forcing `source: "marketplace"` as identity. Optionally add typed optional fields on `LockedDependency` (S3 SHOULD); minimum MUST is round-trip via existing `[key: string]: unknown` + serialize omit-empty.

**Rationale:** Criteria open question resolved — concrete coords + provenance keys.

### D7 — Top-level search CLI (G7)

**Choice:** New FEOD CLI module `Search/` + thin `commands/search.ts` + `app/init` wiring. Expression split on **last** `@`. Reuse `getMarketplace` + `fetchMarketplace` + `manifest.search`. `--limit` default 20; `-v` verbose. Empty match → exit 0 + hint. Nested `marketplace search` **not** registered (S2 deferred).

**Rationale:** APM registers top-level `search`; criteria D6.

### D8 — Plugin source mapping (happy path)

**Choice:**
- github object / Copilot `repository` → git URL `https://github.com/OWNER/REPO` (+ ref from plugin or `#ref` / versionSpec)
- local relative string → absolute/local path relative to marketplace local root
- HTTPS git URL string / url-like source already understood by git classifier → pass through
- else → unsupported-source error (D1)

**Rationale:** Criteria MUST 7; no new host fetchers.

### D9 — Soft OpenAPM note

**Choice:** Design/spec comments only that marketplace remains OpenAPM non-normative / DEFER soft. **No** edits to CONFORMANCE.md or `req-sc-*` tables.

## Risks / Trade-offs

- [Risk] Classifier `@` ambiguity → Mitigation: strict marketplace regex; `/` or `:` before `#` → non-match.
- [Risk] Provenance lost on lock round-trip → Mitigation: acceptance asserts fields; serialize already preserves unknown keys.
- [Risk] Users expect registry-routed plugins to install → Mitigation: clear deferred error pointing to future / experimental registries; documented in D1.
- [Risk] Resolver↔Marketplace cycle → Mitigation: Marketplace must not import Resolver; Resolver imports Marketplace public API only.

## Migration Plan

- Pure additive CLI + resolve behavior; existing projects without marketplace deps unchanged.
- Phase-1 fail-closed marketplace object deps become resolvable after upgrade (behavior change intentional, not BREAKING for happy path).
- Rollback: revert change; registry files under `~/.bapm` remain valid for phase 1 commands.

## Open Questions

- None blocking; S2 nested alias and S3 typed lock fields deferred as optional follow-ups.
