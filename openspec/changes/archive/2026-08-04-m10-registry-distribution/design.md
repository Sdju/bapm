## Context

See `proposal.md` for motivation. Post-M9: `registries:` parse OK (M1); classify marks `registry` then fails with `RESOLVE_REGISTRY_DEFERRED` (M3); M7 pack is plain zip (not registry flat publish); no `publish` / `self-update` CLI. Normative acceptance: `.samples/apm-knowledge/topics/m10-registry-acceptance.md`. Packages: `@b-apm/core` + `@b-apm/cli` only; cursor-only — no new `bapm-target-*`. FEOD: core library modules + CLI thin commands.

## Goals / Non-Goals

**Goals:**

- Injectable registry HTTP client (APM de-facto `/v1/packages/...`)
- Close `RESOLVE_REGISTRY_DEFERRED`; lk-013 before extract; rs-009 mirror-by-hash
- Thin `publish` (flat zip → PUT) behind opt-in experimental gate; emit `apm.yml` in zip root
- Thin `self-update --check` + one upgrade path; primary metadata = **npm**
- Mock HTTP registry in acceptance tests (not a product host)
- Keep dual-read, pack (M7), and non-registry installs green

**Non-Goals (design-level):**

- Marketplace / plugin / find / view / MCP registry browse
- Shipping a registry server or claiming OpenAPM Registry class (rg-001 host)
- Formal OpenAPM v0.2 wire, yank, attestations
- Full APM self-update mirror matrix (aka.ms, multi installer scripts)
- Rewriting M7 pack product into publish layout

## Decisions

### D1: Core `Registry` module owns HTTP client + resolve helpers

- **Choice:** Directory module(s) under `@b-apm/core` (e.g. `Registry`, optionally split `Publish` archive builder / `SelfUpdate` check). Resolver calls Registry public API instead of throwing `RESOLVE_REGISTRY_DEFERRED`. Install reuses the same materialize path after policy gate.
- **Why:** FEOD; keeps HTTP + integrity out of CLI; matches M3 Resolver / M8 Policy pattern.
- **Alternatives:** HTTP only in CLI — rejected (lock/resolve must work from core APIs/tests).

### D2: Injectable HTTP transport; mock registry for acceptance

- **Choice:** Port/adapter for fetch (list/download/PUT). Acceptance tests spin a local mock HTTP server (or in-memory transport) serving APM-shaped JSON + zip bytes with controllable digests. No production registry host in-tree.
- **Why:** Expert note + acceptance checklist require deterministic lk-013 / rs-009 / 401/409 cases.
- **Alternatives:** Hit a public registry in CI — rejected (flake / auth / non-determinism).

### D3: Auth env naming

- **Choice:** Document `BAPM_REGISTRY_TOKEN` as the primary Bearer source; MAY also support per-registry `BAPM_REGISTRY_<NAME>_TOKEN` (uppercased name) when multiple registries need distinct tokens. Anonymous GET when unset.
- **Why:** APM-like `…_TOKEN` spirit with one obvious default for MVP.
- **Alternatives:** Tokens only in YAML — rejected (mf-015 / security).

### D4: Publish emits `apm.yml` inside registry zip

- **Choice:** Authoring tree stays dual-read (`bapm.yml` **or** `apm.yml`). Built registry zip **always** places wire manifest as `apm.yml` at archive root (copy/serialize from whichever brand was loaded). Consumer extract later MUST accept either name; M10 publish side standardizes on `apm.yml` for APM wire drop-in.
- **Why:** Open question recommendation; maximizes interop with APM consumers.
- **Alternatives:** Preserve on-disk filename in zip — weaker cross-tool wire compatibility.

### D5: Opt-in experimental gate for registries + publish

- **Choice:** Gate via env `BAPM_EXPERIMENTAL_REGISTRIES=1` and/or CLI flag documented as enable-registries (APM `experimental enable registries` spirit). Applies to registry resolve/install **and** `publish` by default so accidental network/publish is opt-in. Exact flag spelling fixed in apply; help must name it.
- **Why:** MVP safety; acceptance allows opt-in.
- **Alternatives:** Always-on publish — rejected for accidental PUT risk.

### D6: Flat publish zip ≠ M7 pack; reuse zip I/O only

- **Choice:** Publish builder collects flat root (`apm.yml`, `.apm/**`, optional docs). Reuse existing zip create/hash helpers from Pack/`common` if present; do **not** call pack’s producer-archive product API as the publish artifact.
- **Why:** Acceptance: M7 pack floor stays; layouts differ.
- **Alternatives:** `publish` shells out to `pack` then rewrites — rejected (wrong layout / coupling).

### D7: Self-update metadata primary = npm

- **Choice:** `--check` queries the **npm registry** for the published `bapm` (or documented package name) latest version on the selected channel (`latest` = stable; prerelease via dist-tag / env). Upgrade path SHOULD be `npm i -g <pkg>@<version>` (or `npm update -g`) re-exec / printed command. Inject metadata port for tests.
- **Why:** bapm ships as npm `bin`; one primary source avoids dual-source drift. GitHub Releases deferred as alternate.
- **Alternatives:** GitHub `latest.json` primary — viable but secondary to how users install today.

### D8: `--check` exit policy

- **Choice:** `--check` exits `0` when up-to-date; exits non-zero (e.g. `1`) when an update is available **or** check fails—document in help. Unknown/`0.0.0` → non-zero warn, never “up-to-date”.
- **Why:** Scriptable CI can fail on stale CLI; messaging stays clear.
- **Alternatives:** Always 0 with message only — weaker automation signal.

### D9: FEOD CLI wiring

- **Choice:** `commands/publish`, `commands/self-update`; modules `Publish`, `SelfUpdate` (thin); register in `app`. Core holds domain; CLI argv/exit only.
- **Why:** Locked FEOD profile.

### D10: Policy + registry identities (SHOULD)

- **Choice:** When M8 policy is present, registry package identities participate in allow/deny like other deps (reuse evaluate candidates). No new policy schema in M10 MUST.
- **Why:** Acceptance policy regression; cheap if identity already modeled.

### D11: Conformance claim

- **Choice:** Document Consumer checklist for lk-013 / rs-009; OpenAPM **Registry** class = **N/A** (no host). Do not claim rg-001 product conformance.
- **Why:** Acceptance invariant 22.

## Risks / Trade-offs

- [Experimental gate surprises users who expect always-on resolve] → Clear diagnostics + help; document in README/changelog.
- [npm metadata flaky offline] → Inject port; `--check` fail closed with clear error; no false latest.
- [Large archives buffered in memory] → Prefer streaming/temp-file download when feasible (SHOULD); cap where practical.
- [409 vs identical-bytes republish] → Treat 409 as immutability message; identical-bytes 2xx if server allows (SHOULD).
- [Pack helpers diverge from publish layout] → Explicit separate builder; shared zip primitive only.
- [Gate disables registry in tests accidentally] → Acceptance fixtures set gate env explicitly.

## Migration Plan

1. Core Registry client + injectable transport; unit tests with mock.
2. Wire Resolver to replace `RESOLVE_REGISTRY_DEFERRED`; lk-013 + lock fields; gate.
3. Install path materialize registry after policy; rs-009 replay tests.
4. Publish flat zip builder + CLI `publish` (dry-run/zip/409).
5. `self-update --check` (npm metadata) + help upgrade path; SHOULD install path.
6. Regression: dual-read, git/local install, pack, M8 policy, cursor-only packages.
7. Rollback: restore deferred error / omit commands — lock schema already supports registry shapes (M2).

## Open Questions

- Exact CLI flag spelling for experimental enable (`--experimental-registries` vs env-only) — implementer picks one documented form if both env and flag are redundant.
- Whether registry resolve requires the same experimental gate as publish, or only publish is gated while resolve is always-on once client ships — **prefer same gate for both** unless acceptance tests force always-on resolve; fine-tune in apply against fixtures.
