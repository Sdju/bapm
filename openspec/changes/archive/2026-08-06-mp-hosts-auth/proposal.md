## Why

Marketplace v1 only fetches `github.com|url|local` and hardcodes `api.github.com`, while models already classify `gitlab`/`ado`/`*.ghe.com`. Enterprise and GitLab/ADO users cannot register or fetch marketplaces, and there is no class-scoped env auth. After `mp-sc-claims` honesty, sc-003/005/008/013 stay skipped — this slice is a **product thin expand**, not a false OpenAPM §10.3 claim.

## What Changes

- Unlock marketplace fetch for **gitlab**, **ado**, and **GitHub-class enterprise** (`*.ghe.com` + `GITHUB_HOST` GHES) with correct API bases (stop hardcoding only `api.github.com`).
- Add thin **env-only** token resolve by host class (GitHub-class ≠ GitLab ≠ `ADO_APM_PAT`); fail-closed cross-class reuse and GHES∩GitLab config overlap.
- **ADO transport (locked):** Azure DevOps Items REST API for marketplace.json (parity with GitLab REST); no git-sparse as MUST floor (APM REST-first; git fallback is SHOULD).
- CLI `marketplace add` / `--host` accept unlocked hosts; rewrite v1 “github.com only” messages; keep url HTTPS + local.
- Authoring `check` and pack git resolve use thin tokens for unlocked hosts when present (fail-soft without token where already documented).
- Keep generic `git` kind **refused** (clear message); PROXY_REGISTRY / gh CLI / az bearer / credential helpers = SHOULD defer.
- **CONFORMANCE Strategy A:** leave sc-003/005/008/013 `skipped`; optionally refine rationales (“thin env hosts shipped; full §10.3 not claimed”). MUST NOT mark them `active`.
- Acceptance under `**/mp-hosts-auth/`: host matrix, cross-class refuse, GHE api base, env isolation, github.com/url/local regression.

**Non-goals:** full APM `AuthResolver` port; sc claim flips; Registry HTTP reuse for marketplace.json; dual-read `~/.apm`; generic `git` kind MUST; PROXY_REGISTRY.

## Capabilities

### New Capabilities

- `marketplace-hosts-auth`: Host classification for marketplace (github / ghe_cloud / ghes / gitlab / ado) from hostname + `GITHUB_HOST` / `GITLAB_HOST` / `APM_GITLAB_HOSTS`; thin `resolveTokenForHost` env steps per class; fail-closed cross-class token attach and GHES↔GitLab overlap errors; diagnostic source ids (not literal secrets).

### Modified Capabilities

- `marketplace-fetch-cache`: Dispatch gitlab REST v4, ado Items REST, github Contents via `api_base` (GHE/GHES); cache unlocked remote kinds like github; refuse only generic `git` (until SHOULD); url remains HTTPS-only / no Auth attach.
- `marketplace-cli-consumer`: `add` / `--host` accept unlocked enterprise hosts; remove github.com-only refuse; clear errors on unsupported/overlap.
- `marketplace-models`: Host classify honors enterprise env allowlists; `*.ghe.com` / GHES remain github-class with correct host field (not forced github.com API).
- `marketplace-cli-authoring`: Online `check` uses thin auth / ambient git for unlocked non-github hosts when token or reachability is available; document fail-soft without token.
- `marketplace-pack-outputs`: Pack resolve uses thin auth for unlocked remotes instead of hard fail-closed “no hosts-auth”.
- `openapm-conformance-statement`: After thin hosts+env ship, sc-003/005/008/013 MUST remain `skipped` (Strategy A); rationales MAY note product thin expand without claiming §10.3 classifier/ambient/redirect parity.

## Impact

- `@b-apm/core` Marketplace: `fetch.ts`, `models.ts`, new thin Auth/host helpers (FEOD library module or Marketplace submodule — not Registry HTTP client).
- `bapm` CLI: `runMarketplace.ts` add/`--host`/help; authoring check wiring via core.
- PackOutputs `resolve.ts`, Authoring `check.ts`.
- `tests/spec-conformance/checklist.yml` rationale tweaks only (no active flips); regenerate CONFORMANCE if rationales change.
- Docs/Limitations: residual host-auth depth named (thin env ≠ full OpenAPM §10.3).
- Acceptance: `tests/acceptance/mp-hosts-auth/` (later phase).
