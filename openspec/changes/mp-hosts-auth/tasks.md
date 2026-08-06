## 1. Host classify + thin token resolve (core)

- [x] 1.1 Add Marketplace host classification (`github` / `ghe_cloud` / `ghes` / `gitlab` / `ado` / generic) honoring `GITHUB_HOST`, `GITLAB_HOST`, `APM_GITLAB_HOSTS`, `*.ghe.com`, ADO hostnames; fail-closed on GHES↔GitLab overlap
- [x] 1.2 Wire `MarketplaceSource.kind` / `classifyHost` to the shared classifier (models delta)
- [x] 1.3 Implement thin `resolveTokenForHost` env matrix (GitHub-class / GitLab / `ADO_APM_PAT` only); export diagnostic source id; never leak secret values
- [x] 1.4 Unit tests: class matrix, overlap error, cross-class env isolation (github token unused for gitlab/ado)

## 2. Fetch unlock (core)

- [x] 2.1 GitHub Contents fetch: compute `api_base` (`api.github.com` vs `https://{host}/api/v3`); attach only GitHub-class tokens
- [x] 2.2 Implement GitLab REST v4 raw-file fetch + GitLab-class headers; path auto-detect; size/ref floors
- [x] 2.3 Implement ADO Items REST fetch for decomposable org/project/repo URLs + `ADO_APM_PAT` auth; clear error when URL does not decompose (no MUST git-sparse)
- [x] 2.4 Remove gitlab/ado from `refuseUnsupported`; keep generic `git` refuse with clear message
- [x] 2.5 Extend sidecar cache to gitlab/ado; keep url HTTPS-only / no Auth attach
- [x] 2.6 Unit/integration tests with injectable fetch: GHE api base, gitlab/ado happy path, cross-class header refuse, github.com regression

## 3. CLI consumer unlock

- [x] 3.1 Unlock `marketplace add` / `--host` for enterprise github, gitlab, ado; refuse only generic `git` + overlap
- [x] 3.2 Rewrite help / error strings that claim github.com-only v1
- [x] 3.3 CLI tests: gitlab add probe (mocked fetch), enterprise `--host`, generic git refuse

## 4. Authoring check + pack resolve

- [x] 4.1 Authoring online `check`: thin probe for unlocked remotes when token/ambient git available; fail-soft without token (documented)
- [x] 4.2 PackOutputs resolve: use thin auth for unlocked remotes; fail-closed when sha cannot be produced
- [x] 4.3 Targeted tests for check/pack paths with mocked remotes + env tokens

## 5. CONFORMANCE honesty (Strategy A)

- [x] 5.1 Optionally refine checklist rationales for sc-003/005/008/013 (thin env shipped; full §10.3 not claimed); do **not** set `active`
- [x] 5.2 If rationales changed: `conformance:gen` + `conformance:check`; else leave generated artifacts untouched
- [x] 5.3 Docs/Limitations: name residual host-auth depth (thin env ≠ full OpenAPM §10.3) if wording is stale

## 6. Acceptance suite + verify

- [x] 6.1 Ensure acceptance under `tests/acceptance/mp-hosts-auth/` covers matrix kinds, cross-class refuse, GHE api base, env isolation, github.com/url/local regression, sc-* stay skipped (orchestrate RED→GREEN)
- [x] 6.2 Run package checks/tests for touched core/cli surfaces; fix regressions
