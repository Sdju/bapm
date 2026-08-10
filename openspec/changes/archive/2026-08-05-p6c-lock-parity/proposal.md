## Why

After P6a install UX, bare `bapm lock` still wipes install-written `mcp_*` (and similar) inventory bags on rewrite, and there is no `lock export` SBOM inventory path. APM already ships read-only CycloneDX 1.5 / SPDX 2.3 export plus MCP carry-forward on lockfile-only writes. Closing this P6c parity/correctness gap keeps lock as resolve+write without deploy and stops inventory loss between install and lock.

## What Changes

- Add **`bapm lock export`**: read existing lock → emit CycloneDX 1.5 (default) or SPDX 2.3 JSON; stdout or `-o`; optional `--timestamp` / `SOURCE_DATE_EPOCH`; fail-closed on missing lock; no resolve/network/lock mutate.
- Place SBOM generation in **`@b-apm/core` module `Export`** (not Lockfile YAML R/W); thin CLI parse/help/IO only.
- **Bare lock rewrite** MUST carry-forward opaque top-level inventory bags from the existing document (`mcp_*`, and when present `lsp_*` / `deployments` / unknown/`x-*`) without inventing MCP from disk.
- Accept **`--parallel-downloads 0`** as serial (APM semantics); keep no-deploy guarantee on bare lock; keep `--policy` / `--no-policy`.
- Help/docs notes for export + parallel `0`; bapm-owned SBOM fixtures (not APM golden byte-clone).

**Non-goals / scopeOut:** `--global`; multi-target `--target`; P6b audit formats; P6d policy status CLI; weakening lk-015 `tree_sha256`; attestation/vuln SBOM; recording new `declared_license` at download; ∩-pick / lock sort changes; OpenAPM claim-table churn for SBOM.

## Capabilities

### New Capabilities

- `lock-sbom-export`: Core read-only SBOM inventory from a lockfile document (CycloneDX 1.5 + SPDX 2.3, purl identity, scrub URLs, deterministic JSON, license passthrough).

### Modified Capabilities

- `lock-command`: Subcommand routing `lock` | `lock export`; export flags/IO purity; `--parallel-downloads 0`; help; keep no-deploy and policy flags.
- `dependency-resolve`: `buildLockDocument` / `resolveAndLock` carry-forward of existing top-level inventory bags on lock rewrite (without inventing MCP).
- `core-feod-architecture`: New domain module `Export` under `src/modules/Export` with public API re-exported from `@b-apm/core`.

## Impact

- `@b-apm/core`: new `Export` module + public API; `Resolver.buildLockDocument` carry-forward; CLI-facing export entry; download pool already treats `≤0` as serial via `Math.max(1, …)` once CLI accepts `0`.
- `bapm` CLI Lock: parse `export` subcommand, flags, stderr/stdout purity, help.
- Tests: unit (purl/SBOM/determinism/carry) + CLI acceptance (formats, missing lock, IO purity, MCP carry, parallel `0`).
- Knowledge/roadmap: P6c in flight (out of OpenSpec tree; optional follow-up).
