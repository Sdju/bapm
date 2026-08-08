## Context

See `proposal.md` for motivation. Baseline today: `packages/core` Marketplace `fetch.ts` supports github|url|local, hardcodes `https://api.github.com/...`, and `refuseUnsupported` for gitlab/ado/git; tokens are ambient `GITHUB_TOKEN`|`GH_TOKEN` only. Models already classify gitlab/ado/`*.ghe.com` as kinds, but CLI `runMarketplace.ts` still refuses non-github.com remotes. No Auth module in core. APM reference: `_FETCHERS` with gitlab REST, ado Items REST (+ git fallback), github Contents via `HostInfo.api_base`. Product defaults D1–D7 locked in criteria. FEOD: domain logic in `@bapm/core` Marketplace (library profile); CLI remains thin handlers + module services.

## Goals / Non-Goals

**Goals:**

- Thin host unlock + env-scoped tokens + correct GHE API base + CLI/authoring/pack wiring.
- Lock ADO = REST Items API for MUST floor; keep generic `git` refused.
- Strategy A: sc-003/005/008/013 stay skipped.

**Non-Goals:**

- Porting APM `AuthResolver` (~1.5k LOC), gh CLI, az bearer, credential helper, PROXY_REGISTRY.
- Flipping OpenAPM sc-* to active; Registry HTTP client reuse; dual-read `~/.apm`.

## Decisions

### D1 — Module placement (FEOD)

- Put host classification + `resolveTokenForHost` inside `@bapm/core` `Marketplace` as a small submodule or sibling files exported from `Marketplace/index.ts` (e.g. `hostClassify.ts`, `resolveToken.ts`), **not** a top-level `Auth` package and **not** Registry HTTP.
- CLI consumes via `@bapm/core` public API / existing Marketplace exports; no deep imports.
- **Alternatives:** standalone `modules/Auth` — deferred until broader sc claim / AuthResolver work needs a shared home.

### D2 — ADO transport: REST Items API (locked)

- MUST floor uses Azure DevOps **Git Items REST** (`/_apis/git/repositories/{repo}/items`) for marketplace.json, mirroring APM `_fetch_ado_rest` and GitLab single-file REST.
- **Why not git-sparse first:** APM’s preferred ado path is REST; git is fallback for non-decomposable URLs / REST failure. Thin bapm has no GitCache parity yet; REST matches injectable `fetch` tests and gitlab parity. Non-decomposable ADO URLs → clear fail (or optional SHOULD git later).
- **Alternatives considered:** git-sparse only (heavier, harder to unit-test); REST+git fallback in same MUST (scope creep) — defer fallback as SHOULD.

### D3 — GitHub-class API base

- `github.com` → `https://api.github.com`
- `*.ghe.com` and host == `GITHUB_HOST` → `https://{host}/api/v3`
- Stop hardcoding api.github.com in `fetchGithubAtPath`.

### D4 — Token env matrix (thin)

| Class        | Env (MUST order, first wins)                                                |
| ------------ | --------------------------------------------------------------------------- |
| GitHub-class | `GITHUB_TOKEN`, `GH_TOKEN` (MAY add `GITHUB_APM_PAT` / org-scoped if cheap) |
| GitLab       | `GITLAB_APM_PAT`, `GITLAB_TOKEN`                                            |
| ADO          | `ADO_APM_PAT`                                                               |

- Headers: GitHub `Authorization: Bearer` (or `token` if needed for GHE parity — prefer Bearer consistent with current github.com path unless GHE evidence requires `token`); GitLab `PRIVATE-TOKEN` or Bearer per APM `gitlab_rest_headers`; ADO Basic PAT or Bearer per APM `_ado_auth_header`.
- Cross-class: never consult other class envs.

### D5 — Generic `git` kind

- Keep refuse with message that generic git is out of scope (point to future / criteria S5). No cheap SHOULD unlock in this change unless zero extra surface — default refuse.

### D6 — CONFORMANCE Strategy A

- Do not flip sc-003/005/008/013. Optionally edit checklist rationales to note thin product expand vs full §10.3; regenerate CONFORMANCE only if rationales change.
- Acceptance asserts those IDs remain skipped.

### D7 — Cache

- Extend sidecar cache to gitlab/ado (same TTL path as github/url).

### D8 — Authoring / pack

- Reuse thin resolve + optional `GIT_*` env for `git ls-remote` when probing unlocked remotes; fail-soft on check without token; fail-closed on pack when sha cannot be produced.

## Risks / Trade-offs

- [REST-only ADO misses weird URL shapes] → Mitigation: clear error; SHOULD git fallback later.
- [Thin env mistaken for §10.3 conformance] → Mitigation: Strategy A + docs/Limitations + acceptance guard on skipped sc-*.
- [GHE auth header dialect differs] → Mitigation: start with Bearer; adjust if fixtures show 401 needing `token` prefix.
- [Env allowlist overlap edge cases] → Mitigation: fail-closed message matching APM github_host intent.
- [Authoring ambient git without hardened child env] → Mitigation: do not claim sc-013; document residual.

## Migration Plan

- No registry format break: existing github.com/url/local entries keep working.
- Users gain new host kinds; old “unsupported kind” errors disappear for gitlab/ado/GHE.
- Rollback: revert change; no on-disk migration beyond optional cache entries for new kinds (safe to leave).

## Open Questions

- None blocking plan: ADO REST locked; generic `git` refused; Strategy A locked. Org-scoped `GITHUB_APM_PAT_{ORG}` include-if-cheap can be decided at apply without changing specs (MAY).
