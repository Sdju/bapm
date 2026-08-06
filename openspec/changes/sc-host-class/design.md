## Context

See proposal.md — Why. Today:

- Marketplace `hostClassify` / `resolveToken` isolate env tokens by provider kind only (not PSL eTLD+1 ∪ aliases).
- Policy `hostClassOf` uses last-2-label approximation for extends pin; Manifest keeps `aliases` as opaque `unknown`.
- Registry `createFetchTransport` uses native `fetch` (default redirect follow) with `authHeaders` Bearer — **sc-003 hole**.
- Resolver / Authoring / PackOutputs `spawn("git", …)` inherit ambient env — **sc-013 hole**.
- Mode B: `req-sc-003` / `005` / `008` / `013` skipped; soft-security + governance actives must not regress.

Criteria: `.samples/apm-knowledge/topics/sc-host-class-criteria.md` (G1–G9). FEOD library profile for `@bapm/core` (`modules/<Name>/index.ts` public API; no deep imports). Deps: pnpm catalog CLI only.

## Goals / Non-Goals

**Goals:**

- Close G1–G9 in one XL change with code + Mode B claim flip for `req-sc-003` + `005` + `013` + `008`.
- Shared `Auth` module used by Registry HTTP, Resolver/Authoring/PackOutputs git, Marketplace attach paths.
- Truthful checklist / Limitations; `conformance:gen` + `conformance:check` green.

**Non-Goals:**

- sc-004 tar.gz-only claim.
- Full APM AuthResolver (gh CLI, az bearer, credential helper, `try_with_fallback`) as MUST.
- PROXY_REGISTRY / Artifactory full probe matrix.
- Re-claiming soft-security / governance IDs.

## Decisions

### D1: New FEOD module `packages/core/src/modules/Auth/`
- **Choice:** Directory module with `index.ts` public API exporting classifier, resolve, redirect-safe fetch helper, git env builder / ambient suppress, overlap helpers. Callers import `@/modules/Auth` (or package public API) only.
- **Why:** Criteria D4; FEOD forbids single-file modules and deep imports; shared across Registry / Resolver / Marketplace.
- **Alternatives:** Stuff into Policy or Marketplace — rejected (wrong ownership; Marketplace-only was the honesty failure).

### D2: PSL library = `tldts` via catalog
- **Choice:** Prefer `tldts` (`getDomain` / eTLD+1). Add with `pnpm add tldts --save-catalog --filter @bapm/core` (or `vp`-wrapped equivalent). Never hand-edit `package.json` / catalog versions.
- **Why:** Maintained PSL parsing; criteria D3. Fallback `psl` only if `tldts` blocked.
- **Alternatives:** Hand-rolled last-2 — rejected (not claimable for sc-005).

### D3: Credential class identity
- **Choice:** `credentialHostClassOf(hostname): string` = PSL eTLD+1 (lowercased). Alias map from project registries: each `aliases[]` hostname joins the **same credential class** as the registry entry’s `url` hostname (union). Reuse between two hostnames allowed **iff** same PSL class **or** explicit alias membership — never via CNAME/SAN/redirect observation.
- **Why:** OpenAPM sc-005.
- **Alternatives:** Provider-kind enum as class — rejected (criteria honesty).

### D4: Operator / provider overlap (sc-013 a/b)
- **Choice:** Before resolve, select exactly one **provider class** for attach (marketplace kinds + registry token class). Precedence documented in CONFORMANCE / Limitations: when `ADO_HOST` / `APM_ADO_HOSTS` and `GITHUB_HOST` both claim the same FQDN → **ado wins**; GHES∩GitLab allowlist → **fail-closed** (existing). Extend marketplace classify with ADO_HOST allowlist (S4) for fixture parity.
- **Why:** APM Mode B overlap fixture intent; criteria D7.
- **Alternatives:** Always fail-closed on any overlap — harsher than APM ado-wins; reject for parity.

### D5: Port in scope (sc-013 e)
- **Choice:** Credential cache / HostInfo key = `{ credentialHostClass, hostname, port? }` where non-default explicit port narrows lookup within class (does not create a new PSL class).
- **Why:** Criteria D8 / G7.

### D6: Shared resolve + no cross-class forward (sc-003)
- **Choice:** `resolveCredentialsForHost({ host, port?, registries?, env })` returns at most one credential for the selected class; Registry uses registry-named / global Bearer only when request host class matches registry URL class; Marketplace continues env-name tables per provider class but routes through Auth. Diagnostics expose `source` id only.
- **Why:** G4; sc-007 intact.

### D7: Redirect Auth drop (sc-003)
- **Choice:** Shared `fetchWithRedirectAuthDrop` (or Registry transport uses it): `redirect: 'manual'` (or equivalent), hop budget, compare origin vs Location **credential** host class; if unequal, strip Authorization and other origin-class credential headers before follow; MAY call resolve for destination class. Wire into `createFetchTransport` / Authed Registry client paths. Marketplace URL fetch already attaches no Auth — still prefer shared helper if Auth attaches later (S4).
- **Why:** Criteria D5 / G3; native fetch follow is the hole.
- **Alternatives:** `allow_redirects=False` forever — too strict for same-class CDN hops.

### D8: Ambient suppress + attach (sc-013 c/d)
- **Choice:** `buildGitChildEnv({ host, url, env, registries? })`: clone env → clear platform token names (`GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_APM_PAT*`, `GITLAB_*`, `ADO_*`, and documented peers) → strip / override inherited `http.extraheader` / Authorization git config knobs → attach only selected-class material (header env or `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*` pattern as needed). All consumer git spawns for fetch/validate MUST pass this env (Resolver `runGit`, Authoring check, PackOutputs resolve).
- **Why:** APM `_clear_platform_token_env` / `_clear_git_auth_env` intent; G6.
- **Alternatives:** Document-only suppress — rejected (dishonest claim).

### D9: sc-008 https-only attach refuse
- **Choice:** In attach path: if transport URL scheme is `http:` (not `https:`) and host is not loopback / `::1` and registry `insecure: true` does not apply → **do not attach** credential (and do not leave ambient tokens). Claim `req-sc-008` with Mode B citation.
- **Why:** Attach path lands here; claiming without refuse would be false; criteria allows SHOULD claim when evidenced.
- **Alternatives:** Leave sc-008 skipped — valid but weaker; prefer claim with gate.

### D10: Manifest aliases typed `string[]`
- **Choice:** Parse/validate `registries.*.aliases` as array of hostname strings (or URL host extractable); reject non-arrays / non-strings; feed Auth alias union.
- **Why:** G2; today opaque `unknown`.

### D11: Policy pin vs credential classifier
- **Choice:** **Unify** Policy `hostClassOf` / extends pin to call PSL `credentialHostClassOf` (same helper). Document in Limitations if any pin test relied on last-2 multi-part suffix quirks and adjust fixtures. Do **not** claim sc-005 from pin alone historically — claim rides on Auth + Mode B.
- **Why:** Criteria S2 / D9 prefer unify over dual definitions.
- **Alternatives:** Soft-note dual classifiers — acceptable fallback if unify breaks pl-004 fixtures badly; prefer unify first.

### D12: Claim flip + honesty (G8/G9)
- **Choice:** Flip checklist only after GREEN Mode B under `**/sc-host-class/`: `req-sc-003`, `005`, `013`, `008` → `active` with citations. Keep `req-sc-004` skipped (soft zip). Refresh Limitations: §10.3 host-class floor claimed; residual Auth depth (gh/az/helper) named; soft zip unchanged. `conformance:gen` + `conformance:check`. No hand-edit of generated CONFORMANCE bodies.
- **Why:** Implement-then-claim; criteria D10/D11.

## Gaps → design map

| Gap | Decision / landing |
|-----|-------------------|
| G1 PSL eTLD+1 | D2 + D3 |
| G2 aliases union | D10 + D3 |
| G3 redirect Auth drop | D7 |
| G4 shared resolve | D1 + D6 |
| G5 overlap precedence | D4 |
| G6 ambient suppress | D8 |
| G7 port scope | D5 |
| G8 Mode B + gen | D12 |
| G9 Limitations honesty | D12 + D9 |
| S1 sc-008 | D9 (claimed) |
| S2 unify pin | D11 |
| S4 ADO_HOST | D4 |

## Risks / Trade-offs

- **[Risk] tldts vs last-2 pin fixture drift** → Mitigation: D11 unify + update pl-004 fixtures; acceptance covers multi-part public suffixes (e.g. `github.io` / `co.uk` spirit).
- **[Risk] Redirect loops / hop bombs** → Mitigation: documented max redirects; fail closed.
- **[Risk] Clearing too many env names breaks CI that injects tokens for unrelated tools** → Mitigation: clear only on **git child** env copy, not process-global `process.env`.
- **[Risk] Claiming sc-008 without attach refuse** → Mitigation: refuse gate in D9 before checklist flip.
- **[Risk] False sc-005 on marketplace kind alone** → Mitigation: Mode B MUST assert PSL+aliases classifier, not kind enum.
- **[Risk] FEOD import cycles Auth↔Marketplace** → Mitigation: Auth owns classifier/resolve primitives; Marketplace wraps kinds; Registry/Resolver depend on Auth only.

## Migration Plan

1. Add `tldts` via catalog CLI; scaffold `Auth` module + unit tests (classifier, aliases, overlap, port).
2. Harden Registry transport redirect Auth drop; shared resolve for registry tokens.
3. Wire ambient suppress + sc-008 refuse into Resolver / Authoring / PackOutputs git spawns.
4. Unify Policy pin helper; parse typed aliases.
5. Acceptance + checklist flip + Limitations + `conformance:gen` / `check`; docs align.
6. No user data migration; fail-closed overlap / redirect behavior may change niche enterprise host configs (**intentional** OpenAPM alignment).

## Open Questions

_None blocking — single XL preferred over split A/B; sc-008 claimed with refuse gate; PSL package = tldts via catalog; Policy pin unify preferred._
