## 1. Auth module scaffold + PSL dep (G1, G4)

- [x] 1.1 Add `tldts` to `@b-apm/core` via `pnpm add tldts --save-catalog --filter @b-apm/core` (never hand-edit versions)
- [x] 1.2 Create FEOD `packages/core/src/modules/Auth/` with `index.ts` public API (classifier, resolve, redirect fetch, git env)
- [x] 1.3 Implement `credentialHostClassOf(hostname)` using PSL eTLD+1; unit tests for same/distinct eTLD+1 (no CNAME collapse)
- [x] 1.4 Implement shared `resolveCredentialsForHost` (port in cache key; source-id diagnostics; no cross-class forward)

## 2. Aliases + Manifest + overlap (G2, G5, G7)

- [x] 2.1 Parse/validate `registries.*.aliases` as `string[]` hostnames; update `RegistryEntry` typing; reject bad shapes
- [x] 2.2 Wire aliases into credential class union (alias host ↔ registry `url` host class)
- [x] 2.3 Implement operator overlap: ADO_HOST/`APM_ADO_HOSTS` wins over `GITHUB_HOST` on same FQDN; keep GHES∩GitLab fail-closed; extend marketplace classify
- [x] 2.4 Unit tests: aliases union, ADO-wins overlap, port-scoped lookup within class

## 3. Redirect Auth drop on Registry (G3)

- [x] 3.1 Implement redirect-safe Authed fetch helper (manual redirects, hop budget, class compare, Auth drop / MAY re-resolve)
- [x] 3.2 Wire into Registry `createFetchTransport` / Authed client paths
- [x] 3.3 Unit/integration tests: cross-class 3xx drops Bearer; same-class redirect path; anonymous GET unchanged

## 4. Ambient suppress + sc-008 on git children (G6, S1)

- [x] 4.1 Implement `buildGitChildEnv` (clear platform token env names; strip inherited Auth/`http.extraheader`; attach selected-class only)
- [x] 4.2 Refuse credential attach on non-https git-HTTP except loopback / `insecure` (still suppress ambient)
- [x] 4.3 Wire Resolver, Authoring `check`, PackOutputs resolve git spawns to use `buildGitChildEnv`
- [x] 4.4 Unit tests: ado-selected blanks GitHub tokens; http refuse; https attach; loopback exempt

## 5. Marketplace + Policy unify (S2, S4)

- [x] 5.1 Route Marketplace token/header helpers through Auth where attached; keep kind mapping; ADO allowlist parity
- [x] 5.2 Unify Policy `hostClassOf` / extends pin to PSL credential helper; adjust pl-004 fixtures if needed
- [x] 5.3 Export Auth surface from core public API as needed by CLI/tests

## 6. Acceptance, Mode B claims, docs (G8, G9)

- [x] 6.1 Acceptance suite under `**/sc-host-class/` covering G1–G9 (+ sc-008): PSL vs aliases, cross-class redirect, overlap+ambient, https refuse, checklist expectations
- [x] 6.2 Flip checklist `req-sc-003`/`005`/`013`/`008` → `active` with citations only after GREEN; keep `req-sc-004` skipped; no citation churn on 001/002/006/007/009/010/011/012
- [x] 6.3 Update Limitations/scope_out: claimed §10.3 host-class floor; residual Auth depth; soft zip unchanged
- [x] 6.4 Run `conformance:gen` + `conformance:check`; align docs-openapm-boundary residual wording
