## Why

Mode B still skips OpenAPM §10.3 host-class IDs after thin marketplace env unlock (`mp-hosts-auth`), soft-security, and executable governance. Marketplace kind enums and last-2-label policy pins are **not** a truthful credential host-class; Registry `fetch` follows redirects with Authorization intact; Resolver/Authoring/PackOutputs git children inherit ambient tokens. Product call is **implement-then-claim**: one XL change closes shared PSL+aliases class, redirect Auth drop, overlap precedence, and ambient suppress with Mode B evidence — no false actives.

## What Changes

- Shared **credential host-class** in `@bapm/core` (new FEOD `Auth` module): **PSL eTLD+1** (library via pnpm catalog) ∪ typed `registries.*.aliases` host→class union; no CNAME/SAN/redirect collapse for reuse.
- **Shared resolve per class** for consumer Authed paths (Registry Bearer scoped to registry host class; Marketplace thin resolve upgraded to shared helpers where attached); never forward class A credentials to class B; diagnostics use **source id** only (sc-007 intact).
- **Redirect Auth drop** on Registry (and any Authed HTTP using the shared helper): manual / `redirect: 'manual'` follow; on 3xx whose Location host class ≠ origin class, drop originating Authorization / class credential material before the redirected request; MAY re-resolve for destination class.
- **Operator overlap**: exactly one effective class before resolve; documented deterministic precedence (ADO_HOST / `APM_ADO_HOSTS` before GITHUB_HOST when both claim the same FQDN; GHES∩GitLab fail-closed retained); non-default **port** stays in transport + credential cache key within class.
- **Ambient suppress** on every consumer git spawn used for fetch/validate (Resolver, Authoring `check`, PackOutputs resolve, and any install git): clear platform token env names + strip inherited Auth / `http.extraheader`; then attach only selected-class material.
- **SHOULD sc-008**: refuse attaching a credential to git-over-HTTP whose URL scheme is not `https://`, unless loopback (`127.0.0.0/8`, `::1`) or registry `insecure: true` — claimable because the attach path lands in this change.
- Flip CONFORMANCE checklist: `req-sc-003` + `req-sc-005` + `req-sc-013` + `req-sc-008` → `active` with Mode B citations under `**/sc-host-class/`; keep `req-sc-004` skipped; no churn on already-active soft-security / governance IDs.
- Regenerate `CONFORMANCE.md` / `CONFORMANCE.json` via `conformance:gen`; `conformance:check` green; Limitations name residual Auth depth (gh CLI / az bearer / credential-helper matrix) honestly if not ported.
- Acceptance under `**/sc-host-class/` covering PSL vs aliases, cross-class redirect drop, overlap+ambient, https-only attach refuse, checklist claim set.

**Non-goals:** claim sc-004 tar.gz-only; full APM AuthResolver LOC (gh/az/helper/`try_with_fallback` as MUST); PROXY_REGISTRY / Artifactory full matrix; re-claim soft-security / governance IDs; hand-edit generated CONFORMANCE; invent PSL library versions by hand (pnpm catalog / CLI only).

## Capabilities

### New Capabilities

- `credential-host-class`: Shared OpenAPM §10.3 credential host-class = PSL eTLD+1 ∪ `registries.*.aliases`; overlap precedence; port-scoped identity; shared resolve that never forwards cross-class credentials.
- `redirect-auth-drop`: Authed consumer HTTP follows redirects without carrying origin-class Authorization across host-class boundaries.
- `git-ambient-suppress`: Git/transport children suppress ambient platform token env and inherited Auth config, attach only selected-class credentials, and refuse non-https git-HTTP credential attach except loopback / `insecure`.

### Modified Capabilities

- `registry-http-client`: Production Authed Registry transport MUST use redirect-safe fetch (manual redirects + Auth drop / re-resolve).
- `marketplace-hosts-auth`: Marketplace classify/resolve MUST align with shared credential host-class helpers (provider kinds + ADO_HOST allowlist parity); thin env scoping remains, upgraded where it attaches credentials.
- `manifest-yaml-validate`: Parse `registries.*.aliases` as typed `string[]` (hostnames) usable by the credential class union.
- `dependency-resolve`: Git download/ref-resolution children MUST use ambient-suppress + class-scoped attach (and sc-008 refuse) for consumer git spawns.
- `marketplace-pack-outputs`: PackOutputs git resolve children MUST use the same ambient-suppress / attach policy.
- `marketplace-cli-authoring`: Authoring `check` git children MUST use the same policy.
- `policy-extends-resolve`: Document dual-classifier honesty **or** unify extends pin with PSL credential classifier (prefer unify when cheap); MUST NOT claim sc-005 from last-2 pin alone.
- `openapm-conformance-statement`: Activate `req-sc-003` / `005` / `013` / `008` with Mode B citations; keep `req-sc-004` skipped; refresh Limitations (host-class claimed floor; residual Auth depth; soft zip unchanged).
- `docs-openapm-boundary`: Align guide residual wording with claimed §10.3 host-class floor and residual Auth depth / soft zip.

## Impact

- `@bapm/core`: new `modules/Auth/` (FEOD library); Registry `transport` / client; Manifest aliases typing; Marketplace hostClassify/resolveToken; Resolver / Authoring / PackOutputs git spawn env; optional Policy `hostClassOf` unify.
- Dependencies: add PSL library (`tldts` preferred, or `psl`) to `@bapm/core` **only** via `pnpm add … --save-catalog --filter @bapm/core` (never hand-edit versions).
- Mode B: `tests/spec-conformance/checklist.yml` → `conformance:gen` / `conformance:check`; Limitations / scope_out.
- Docs: OpenAPM boundary guide residual security wording.
- Tests: unit + acceptance under `**/sc-host-class/`; Mode B citation paths for claimed IDs.
- Does **not** ship gh CLI / az bearer / credential-helper matrix as claim floor; does **not** activate sc-004.
