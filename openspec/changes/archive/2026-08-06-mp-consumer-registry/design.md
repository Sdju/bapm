## Context

See proposal.md — Why. Criteria: `.samples/apm-knowledge/topics/mp-consumer-registry-criteria.md`; research phase-1 row in `research-marketplace-plugin-search-find.md`. Baseline: no marketplace CLI; Resolver `kind: "marketplace"` fail-closed (unchanged); `packages/core` `Registry/` = package HTTP only; no `~/.bapm` user-config convention yet. APM references: `marketplace/models.py`, `registry.py`, `client.py`, `validator.py`, `commands/marketplace/__init__.py`.

## Goals / Non-Goals

**Goals:**
- Close gaps G1–G12 in core + CLI with FEOD boundaries.
- Ship thin `validate` (schema + duplicate names) — G12 decision: **ship**, not DEFER.
- Document `~/.bapm` paths and host limits in this design.

**Non-Goals (design-level):**
- No ETag/SWR/cross-process lock as MUST (S1–S3 deferred).
- No full AuthResolver / GHES / PROXY_REGISTRY matrix (S4 = thin env token only).
- No search/install/Resolver wiring; no CONFORMANCE edits.

## Decisions

### D1 — Core module layout (G1)

**Choice:** New `packages/core/src/modules/Marketplace/` with public `index.ts` exporting:
- models + `parseMarketplaceJson` / `urlNamesRemoteManifest`
- config paths (`getBapmConfigDir`, `marketplacesJsonPath`, `marketplaceCacheDir`, `ensureBapmConfigDir`)
- registry CRUD (`list`/`get`/`add`/`remove`)
- fetch (`fetchMarketplace`, `clearMarketplaceCache`, `autoDetectMarketplacePath`)
- errors (`MarketplaceError`, `MarketplaceNotFoundError`, `MarketplaceFetchError`, …)
- thin validate (`validateMarketplace` → schema + duplicate names)

Internal files (suggested): `models.ts`, `parse.ts`, `paths.ts`, `registry.ts`, `cache.ts`, `fetch.ts` (+ `fetchGithub.ts` / `fetchUrl.ts` / `fetchLocal.ts` if size warrants), `validate.ts`, `errors.ts`, `types.ts`.

**Rationale:** Mirrors APM package split; orthogonal to Registry HTTP (D5 locked).

**Alternative:** Hang under Registry — rejected (criteria MUST NOT 1).

### D2 — `~/.bapm` config root (G2)

**Choice:** `path.join(os.homedir(), ".bapm")` as sole config root. Ensure dir on first write (`mkdir` recursive, mode `0o700` when creating). Paths:
- Registry: `~/.bapm/marketplaces.json`
- Cache: `~/.bapm/cache/marketplace/<safeKey>.json` + `.meta.json`

Allow test override via optional `configDir` / `BAPM_CONFIG_DIR` inject on public options (prefer explicit options in APIs over env for unit tests; env optional if cheap).

**Rationale:** D2 locked; dual-read `~/.apm` OOS.

### D3 — Models + parse (G3)

**Choice:** Port APM frozen dataclasses as readonly TS types / `Object.freeze` where practical. `MarketplaceSource.kind` derived property (not stored). Skip npm sources; parse `registry` + require version when set; retain field unused by install until `mp-search-install`.

**Rationale:** Spec marketplace-models; install coupling deferred.

### D4 — Registry CRUD (G4)

**Choice:** Load `{ marketplaces: [] }`; `add` filters case-insensitive then append; atomic `*.tmp` + `rename`. Process-local cache optional. No shard_lock (S3 deferred).

**Rationale:** APM `registry.py` intent without cross-process lock complexity.

### D5 — Fetch transport (G5, open question)

**Choice:** 
- **github.com:** HTTPS GitHub Contents API `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}` with `Accept: application/vnd.github.raw` (or decode `content` base64 from JSON). Unauthenticated public happy path. If `process.env.GITHUB_TOKEN` or `GH_TOKEN` set, send `Authorization: Bearer <token>` (never log value) — S4 thin.
- **url:** native `fetch` (injectable) HTTPS-only, follow redirects ≤5, reject if final URL is non-HTTPS; stream/chunk with ~10 MiB cap.
- **local:** read file; if directory, probe candidates; optional `git --git-dir show` for bare repos if already needed — keep minimal (working tree + direct file first).
- Refuse `gitlab`/`ado`/`git` at fetch **and** at `add` after kind derivation (clear message: use hosts later / `mp-hosts-auth`).

**Rationale:** Criteria open question — Contents API avoids cloning; no dependency on existing git helpers for happy path. Do not reuse Registry HTTP client.

**Alternative:** `git sparse-checkout` via existing helpers — heavier; defer.

### D6 — Cache TTL + force (G6)

**Choice:** TTL 3600s in `.meta.json` (`fetched_at`, `ttl_seconds`). `forceRefresh` skips read. `update` / successful `add` probe use force. Local: no write to sidecar required. ETag/SWR deferred (S1/S2).

**Rationale:** APM client subset.

### D7 — Path candidates (G7)

**Choice:** Ordered `_MARKETPLACE_PATHS` = `marketplace.json`, `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json`. Auto-detect on github + local dir when path is default/empty-for-dir. Direct url → `path: ""`. Direct file → path empty or basename as APM does.

### D8 — CLI FEOD (G8)

**Choice:** Mirror Cache/Doctor pattern:
- `packages/cli/src/modules/Marketplace/` (`createMarketplace`, parse/help/run services)
- `commands/marketplace.ts` thin handler
- `app/init/marketplace.ts` + `registry.ts` entry `COMMAND_MARKETPLACE`
- Help: top-level + `marketplace --help` lists consumer subcommands only

**Rationale:** Locked FEOD; closes G8.

### D9 — add SOURCE parsing (G9)

**Choice:** Port APM `_parse_marketplace_source` subset for v1 hosts only:
- `OWNER/REPO` → github.com (+ `--host` only for github.com in v1; non-github host → refuse)
- HTTPS github.com repo URL (+ optional `#ref`)
- HTTPS `.../marketplace.json` → url kind
- local / `file://`
- Alias default: repo name or sanitized basename; `--name` must match `^[a-zA-Z0-9._-]+$`
- Probe `fetchMarketplace(..., { forceRefresh: true })` before `addMarketplace`

**Rationale:** Criteria MUST 7; refuse gitlab SSH/ADO early.

### D10 — Security floors (G10)

**Choice:** HTTPS-only url; redirect-to-HTTP reject; 10 MiB bound; `_SAFE_REF_RE`; sanitize cache keys; local path segment traversal guards (reject `..` / empty / `.` segments in relative path components).

### D11 — Thin validate ships (G12)

**Choice:** Implement `validateMarketplace(manifest)` with Schema + Names checks (APM `validator.py`). CLI `marketplace validate NAME`. `--check-refs` not implemented; help MUST NOT claim it.

**Rationale:** Small surface; criteria prefers ship-or-DEFER — ship closes G12 cleanly.

### D12 — Tests placement (G11)

**Choice:** Acceptance suite `tests/acceptance/mp-consumer-registry/` (orchestrator RED→GREEN). Core unit: parse fixtures (Copilot+Claude), registry temp dir, fetch mock url+local (+ github mock). CLI smoke: add/list/browse/update/remove/validate.

### D13 — Resolver unchanged

**Choice:** Do not touch marketplace fail-closed in Resolver/Install.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Contents API rate-limit / private repos | Public unauth path documented; thin token header; full auth → `mp-hosts-auth` |
| Kind derivation classifies gitlab before refuse | Explicit refuse at add+fetch with clear message |
| Atomic write without lock → lost update | Accept v1; document; S3 later |
| Help sprawl | Consumer-only section; no authoring verbs |
| Accidental Registry coupling | Lint/review: Marketplace MUST NOT import Registry createClient |

## Migration Plan

- No migration of `~/.apm`; users re-`add` sources under `~/.bapm`.
- Rollback: remove CLI registration + module (no lockfile format change).
- Next change `mp-search-install` consumes this registry + fetch API.

## Open Questions

- None blocking; GHES Contents API host override deferred to `mp-hosts-auth`.
