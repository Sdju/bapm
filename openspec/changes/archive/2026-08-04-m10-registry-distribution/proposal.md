## Why

M1–M9 delivered Consumer/Producer floor through install, cursor materialize, lifecycle, pack, policy, and APM extras—but registry-sourced deps still fail with `RESOLVE_REGISTRY_DEFERRED`, and there is no thin `publish` or `self-update`. M10 closes **thin registry distribution**: HTTP client + resolve/install with integrity (lk-013 / rs-009), flat-zip publish, and CLI version check—without hosting a registry server or raising marketplace/plugin into MUST.

## What Changes

- **Registry HTTP client (core):** thin client compatible with APM de-facto `/v1/packages/{owner}/{repo}/…` (list versions, download, publish PUT); Bearer auth from documented env (`BAPM_REGISTRY_TOKEN` and/or per-registry `…_TOKEN`); anonymous GET when no token; fail closed on transport/JSON/cap/4xx with actionable diagnostics; **MUST NOT** silently fall back registry deps to git
- **Resolve + install registry deps:** replace M3 `RESOLVE_REGISTRY_DEFERRED` for supported registry entries; use manifest `registries:` (+ `registries.default`); semver/exact pick from version list; download → SHA-256 → **lk-013** verify advertised digest **before** extract; materialize into modules cache; lock `resolved_url` + `resolved_hash` (`sha256:<hex>`); **rs-009** mirror URL MAY differ iff bytes match `resolved_hash`; policy gate (M8) still before durable writes
- **Thin `bapm publish`:** require `owner/repo` + version from dual-read manifest; build **flat** registry zip (recommend emit `apm.yml` at zip root for wire compatibility + `.apm/` + optional root docs)—not M7 plugin/pack wrapper; PUT upload; `--dry-run` / `--zip`; surface 409 immutability, 422 validation, 401/403 auth; **opt-in experimental gate** (flag or env) to avoid accidental publishes
- **Thin `bapm self-update --check`:** compare running CLI version to latest published channel; refuse false “latest” on unknown/`0.0.0`; help documents upgrade path; **SHOULD** one install/upgrade path (pick one primary metadata source: npm vs GitHub—design decides)
- **Invariants:** dual-read unchanged (`apm.yml` **or** `bapm.yml`, not both); **MUST NOT** add new `bapm-target-*` (cursor-only); FEOD; hard-error unknown flags; M7 `pack` reused for zip I/O only (not rewritten); marketplace deps still fail closed / deferred; OpenAPM Registry class (**rg-001 host claim**) N/A unless host ships
- **HARD packages:** `@b-apm/core`, `@b-apm/cli` only; target packages only if unavoidable—prefer zero touch

## Capabilities

### New Capabilities

- `registry-http-client`: Thin APM-wire package-registry HTTP client (list/download/publish PUT), auth, caps, fail-closed diagnostics; injectable for mock HTTP acceptance tests
- `registry-resolve-install`: Close `RESOLVE_REGISTRY_DEFERRED`; registry resolve/install with semver pick, lk-013 pre-extract verify, rs-009 mirror-by-hash, lock populate; no silent git fallback
- `producer-publish`: Thin `bapm publish`—flat registry zip (emit `apm.yml` in zip root) + PUT; dry-run/zip flags; experimental opt-in gate; distinct from M7 pack layout
- `cli-self-update`: Thin `bapm self-update --check` (+ SHOULD one upgrade path); channel/metadata source; unknown-version safety

### Modified Capabilities

- `dependency-resolve`: Replace registry deferred failure with real registry fetch path for supported entries; keep marketplace deferred/fail-closed
- `install-pipeline`: Integrate registry archive materialize into install/lock after policy gate; non-registry projects unchanged
- `lockfile-yaml-rw`: Clarify that registry `resolved_hash` is verified on fetch (lk-013) and may be replayed via mirror (rs-009)—shape rules unchanged
- `cli-runtime-surface`: Help/dispatch for `publish` and `self-update`; hard-reject unknown flags
- `cli-feod-architecture`: Thin FEOD handlers/modules for publish, self-update, registry wiring; no business logic in `commands/`/`app/`
- `core-feod-architecture`: Core Registry (and related) modules + public API for client/resolve/publish helpers; no core→cursor hard dep
- `target-package-architecture`: Reaffirm allow-list only `bapm-target-api` + `bapm-target-cursor`; forbid new hosts in M10
- `producer-pack-archive`: Clarify M7 plain pack ≠ registry flat publish zip; publish MAY reuse pack zip I/O helpers only—do not rewrite pack product

## Impact

- **`@b-apm/core`:** Registry HTTP client + resolver path; integrity before extract; lock registry fields on resolve; publish archive builder (flat layout); self-update check helpers (version compare / metadata fetch port)
- **`bapm` CLI:** `publish`, `self-update` (`--check` MUST; upgrade path SHOULD); experimental registries/publish gate; help updates
- **Targets:** prefer **no** changes; MUST NOT add `bapm-target-*`
- **Acceptance tests:** mock HTTP registry fixture server (not a product host)
- **Out of scope (explicit DEFER):** marketplace CLI; plugin init / Claude plugin.json / `--format plugin` pack; registry **server**/host / OpenAPM **rg-001** claim; formal OpenAPM v0.2 wire/yank/attestations; full APM self-update mirror matrix; MCP registry browse; `find`/`view`/search discovery UX; auto git-tag create/push from publish
